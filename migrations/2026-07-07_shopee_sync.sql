-- ============================================================
-- Shopee order sync: token storage, synced-order ledger, and an
-- atomic order-logging RPC. Safe to re-run (idempotent).
-- Supabase SQL Editor auto-commits per Run — no BEGIN/COMMIT.
-- ============================================================

-- Shop-level OAuth tokens (access token expires ~4h, refresh ~30d).
-- Service-role only: RLS enabled with NO policies, so the anon key
-- can never read tokens. Only the edge function (service role) can.
CREATE TABLE IF NOT EXISTS public.shopee_auth (
    shop_id BIGINT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shopee_auth ENABLE ROW LEVEL SECURITY;

-- Idempotency ledger: one row per Shopee order ever logged, so a
-- re-sync (or a retry after a partial failure) can never double-log.
CREATE TABLE IF NOT EXISTS public.shopee_synced_orders (
    order_sn TEXT PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    items JSONB NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shopee_synced_orders ENABLE ROW LEVEL SECURITY;
-- Read-only visibility for the app (sync history display); writes stay service-role only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shopee_synced_orders'
      AND policyname = 'Public read on shopee_synced_orders'
  ) THEN
    CREATE POLICY "Public read on shopee_synced_orders"
      ON public.shopee_synced_orders FOR SELECT USING (true);
  END IF;
END;
$$;

-- Logs one Shopee order atomically: every line item goes through
-- log_sale (stock guard + sale + movement), then the order is marked
-- synced — all in one transaction. Re-syncing a marked order is a
-- no-op ('already_synced'). Any failure (e.g. insufficient stock)
-- rolls back the entire order, so retries are always safe.
-- p_items: jsonb array of {variant_id uuid, qty int, revenue numeric,
--          cost_price_at_sale numeric}
CREATE OR REPLACE FUNCTION public.log_shopee_order(
  p_order_sn TEXT, p_shop_id BIGINT, p_sale_date DATE, p_items JSONB
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item JSONB;
BEGIN
  -- FOR UPDATE-free existence check is fine: the PK insert below is the
  -- real race guard (second concurrent sync hits a unique violation and
  -- rolls back its duplicate sales).
  IF EXISTS (SELECT 1 FROM public.shopee_synced_orders WHERE order_sn = p_order_sn) THEN
    RETURN 'already_synced';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    PERFORM public.log_sale(
      (v_item->>'variant_id')::UUID,
      (v_item->>'qty')::INTEGER,
      'Shopee',
      p_sale_date,
      (v_item->>'revenue')::NUMERIC,
      (v_item->>'cost_price_at_sale')::NUMERIC
    );
  END LOOP;

  INSERT INTO public.shopee_synced_orders (order_sn, shop_id, items)
  VALUES (p_order_sn, p_shop_id, p_items);

  RETURN 'synced';
END;
$$;
