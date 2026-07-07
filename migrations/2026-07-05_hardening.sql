-- ============================================================
-- 2026-07-05 hardening migration — Avenue of Hers
-- Idempotent: safe to re-run. Paste into the Supabase SQL Editor.
-- NOTE: the SQL Editor auto-commits per Run — no BEGIN/COMMIT here.
-- Run the commented PRECHECK queries first; fix any rows they
-- return before applying the corresponding change.
-- ============================================================

-- ------------------------------------------------------------
-- 1. sales.cost_price_at_sale — used by log_sale and the app,
--    but was missing from the original DDL.
-- ------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS cost_price_at_sale NUMERIC NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. Widen sales.platform CHECK to include 'Instagram'
--    (stock_movements already allows it; UI keeps Instagram).
-- ------------------------------------------------------------
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_platform_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_platform_check
  CHECK (platform IN ('Shopee', 'TikTok', 'Instagram', 'Other'));

-- ------------------------------------------------------------
-- 3. Non-negative stock guard on product_variants.stock_qty.
--    PRECHECK: existing negative rows will block adding the CHECK.
--    Detect them first:
--      SELECT id, sku, stock_qty FROM public.product_variants WHERE stock_qty < 0;
--    Optional fix (review before running — this zeroes negatives):
--      -- UPDATE public.product_variants SET stock_qty = 0 WHERE stock_qty < 0;
-- ------------------------------------------------------------
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_stock_qty_check;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_stock_qty_check CHECK (stock_qty >= 0);

-- ------------------------------------------------------------
-- 5. Uniqueness constraints.
--    PRECHECK: existing duplicates will block these ALTERs.
--    Detect duplicate variants:
--      SELECT product_id, size, color, COUNT(*) FROM public.product_variants
--      GROUP BY product_id, size, color HAVING COUNT(*) > 1;
--    Detect duplicate product names:
--      SELECT name, COUNT(*) FROM public.products
--      GROUP BY name HAVING COUNT(*) > 1;
--    Merge/rename any duplicates before running the ALTERs below.
-- ------------------------------------------------------------
ALTER TABLE public.product_variants DROP CONSTRAINT IF EXISTS product_variants_product_id_size_color_key;
ALTER TABLE public.product_variants
  ADD CONSTRAINT product_variants_product_id_size_color_key UNIQUE (product_id, size, color);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_name_key;
ALTER TABLE public.products
  ADD CONSTRAINT products_name_key UNIQUE (name);

-- ------------------------------------------------------------
-- 6. Enable RLS on stock_movements (policy existed, RLS did not).
--    Defensively (re)create the policy first: on a DB missing it,
--    enabling RLS without any policy would block ALL access.
--    (CREATE POLICY has no IF NOT EXISTS, hence the DO block.)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_movements'
      AND policyname = 'Public full access on stock_movements'
  ) THEN
    CREATE POLICY "Public full access on stock_movements"
      ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 7. stock_movements.variant_id FK: CASCADE → RESTRICT so deleting
--    a variant can no longer silently erase its audit trail.
-- ------------------------------------------------------------
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_variant_id_fkey;
ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------
-- 3 (function part) + 4. Rebuild log_sale with an insufficient-stock
-- guard, and cancel_sale with an audit-trail stock movement.
-- ------------------------------------------------------------

-- Atomic sale logging: inserts sale + decrements stock + records stock movement in one transaction
CREATE OR REPLACE FUNCTION log_sale(
  p_variant_id UUID, p_qty INTEGER, p_platform TEXT,
  p_sale_date DATE, p_revenue NUMERIC, p_cost_price_at_sale NUMERIC
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stock INTEGER;
BEGIN
  -- Lock the variant row and guard against overselling
  SELECT stock_qty INTO v_stock FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Variant not found'; END IF;
  IF v_stock < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock: only % left', v_stock;
  END IF;
  INSERT INTO public.sales (variant_id, qty, platform, sale_date, revenue, cost_price_at_sale)
  VALUES (p_variant_id, p_qty, p_platform, p_sale_date, p_revenue, p_cost_price_at_sale);
  UPDATE public.product_variants SET stock_qty = stock_qty - p_qty WHERE id = p_variant_id;
  INSERT INTO public.stock_movements (variant_id, type, qty, platform, note)
  VALUES (p_variant_id, 'out', p_qty,
    CASE WHEN p_platform IN ('Shopee', 'TikTok', 'Instagram') THEN p_platform ELSE NULL END,
    'Sale');
END;
$$;

-- Reverses a logged sale: deletes the sale row + restores stock in one transaction
CREATE OR REPLACE FUNCTION cancel_sale(p_sale_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_variant_id UUID;
  v_qty INTEGER;
BEGIN
  -- FOR UPDATE: two concurrent reversals of the same sale would otherwise both read
  -- the row and double-restore stock (the second DELETE silently matches zero rows).
  SELECT variant_id, qty INTO v_variant_id, v_qty FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  DELETE FROM public.sales WHERE id = p_sale_id;
  UPDATE public.product_variants SET stock_qty = stock_qty + v_qty WHERE id = v_variant_id;
  INSERT INTO public.stock_movements (variant_id, type, qty, note)
  VALUES (v_variant_id, 'in', v_qty, 'Sale reversal');
END;
$$;

-- ------------------------------------------------------------
-- 8. Batch RPCs — all-or-nothing (a plpgsql function body runs in
--    a single transaction; any RAISE rolls back the whole batch).
-- ------------------------------------------------------------

-- Batch sale logging: applies log_sale logic to a jsonb array of sales.
-- p_sales: jsonb array of {variant_id uuid, qty int, platform text,
--          sale_date date, revenue numeric, cost_price_at_sale numeric}
CREATE OR REPLACE FUNCTION log_sale_batch(p_sales jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale jsonb;
  v_variant_id UUID;
  v_qty INTEGER;
  v_platform TEXT;
  v_sale_date DATE;
  v_revenue NUMERIC;
  v_cost NUMERIC;
  v_stock INTEGER;
BEGIN
  IF p_sales IS NULL OR jsonb_typeof(p_sales) <> 'array' THEN
    RAISE EXCEPTION 'p_sales must be a jsonb array';
  END IF;
  FOR v_sale IN SELECT * FROM jsonb_array_elements(p_sales) LOOP
    v_variant_id := (v_sale->>'variant_id')::UUID;
    v_qty        := (v_sale->>'qty')::INTEGER;
    v_platform   := v_sale->>'platform';
    v_sale_date  := (v_sale->>'sale_date')::DATE;
    v_revenue    := (v_sale->>'revenue')::NUMERIC;
    v_cost       := (v_sale->>'cost_price_at_sale')::NUMERIC;

    -- Lock the variant row and guard against overselling
    SELECT stock_qty INTO v_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variant not found'; END IF;
    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock: only % left', v_stock;
    END IF;
    INSERT INTO public.sales (variant_id, qty, platform, sale_date, revenue, cost_price_at_sale)
    VALUES (v_variant_id, v_qty, v_platform, v_sale_date, v_revenue, v_cost);
    UPDATE public.product_variants SET stock_qty = stock_qty - v_qty WHERE id = v_variant_id;
    INSERT INTO public.stock_movements (variant_id, type, qty, platform, note)
    VALUES (v_variant_id, 'out', v_qty,
      CASE WHEN v_platform IN ('Shopee', 'TikTok', 'Instagram') THEN v_platform ELSE NULL END,
      'Sale');
  END LOOP;
END;
$$;

-- Batch stock adjustment: applies adjust_stock logic to a jsonb array.
-- p_adjustments: jsonb array of {variant_id uuid, type text, qty int,
--                note text, platform text|null}
CREATE OR REPLACE FUNCTION adjust_stock_batch(p_adjustments jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_adj jsonb;
  v_variant_id UUID;
  v_type TEXT;
  v_qty INTEGER;
  v_note TEXT;
  v_platform TEXT;
BEGIN
  IF p_adjustments IS NULL OR jsonb_typeof(p_adjustments) <> 'array' THEN
    RAISE EXCEPTION 'p_adjustments must be a jsonb array';
  END IF;
  FOR v_adj IN SELECT * FROM jsonb_array_elements(p_adjustments) LOOP
    v_variant_id := (v_adj->>'variant_id')::UUID;
    v_type       := v_adj->>'type';
    v_qty        := (v_adj->>'qty')::INTEGER;
    v_note       := v_adj->>'note';
    v_platform   := v_adj->>'platform';

    INSERT INTO public.stock_movements (variant_id, type, qty, platform, note)
    VALUES (v_variant_id, v_type, v_qty, v_platform, v_note);
    IF v_type = 'in' THEN
      UPDATE public.product_variants SET stock_qty = stock_qty + v_qty WHERE id = v_variant_id;
    ELSE
      UPDATE public.product_variants SET stock_qty = stock_qty - v_qty WHERE id = v_variant_id;
    END IF;
  END LOOP;
END;
$$;
