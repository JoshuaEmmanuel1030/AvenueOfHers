-- Run this in Supabase SQL Editor.
-- If you ran the old schema, run the DROP statements first.

-- ============================================================
-- MIGRATION (run this block ONLY if you already have data and
-- want to add Catalogue support without wiping the DB):
-- ============================================================
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS collection TEXT;
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_sizes TEXT[] NOT NULL DEFAULT '{}';
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_colors TEXT[] NOT NULL DEFAULT '{}';
-- ============================================================

DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.sales;
DROP TABLE IF EXISTS public.product_variants;
DROP TABLE IF EXISTS public.products;

-- Products table — represents a style/design (e.g. "Floral Midi Dress")
-- Catalogue-defined: available_sizes/colors constrain what variants can exist
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    description TEXT,
    collection TEXT,
    available_sizes TEXT[] NOT NULL DEFAULT '{}',
    available_colors TEXT[] NOT NULL DEFAULT '{}',
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Variants table — each size/color combination with its own cost, price, and stock
CREATE TABLE public.product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    sell_price NUMERIC NOT NULL DEFAULT 0,
    stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    reorder_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (product_id, size, color)
);

-- Sales table — references a specific variant, not just a product
-- ON DELETE RESTRICT prevents deleting a variant that has sales history
CREATE TABLE public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT NOT NULL,
    qty INTEGER NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('Shopee', 'TikTok', 'Instagram', 'Other')),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    revenue NUMERIC NOT NULL,
    cost_price_at_sale NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
-- Stock movement audit log
CREATE TABLE public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    qty INTEGER NOT NULL,
    platform TEXT CHECK (platform IN ('Shopee', 'TikTok', 'Instagram', 'Manual')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

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

-- Atomic stock adjustment: inserts movement + updates stock in one transaction
CREATE OR REPLACE FUNCTION adjust_stock(
  p_variant_id UUID, p_type TEXT, p_qty INTEGER, p_platform TEXT, p_note TEXT
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.stock_movements (variant_id, type, qty, platform, note)
  VALUES (p_variant_id, p_type, p_qty, p_platform, p_note);
  IF p_type = 'in' THEN
    UPDATE public.product_variants SET stock_qty = stock_qty + p_qty WHERE id = p_variant_id;
  ELSE
    UPDATE public.product_variants SET stock_qty = stock_qty - p_qty WHERE id = p_variant_id;
  END IF;
END;
$$;

-- Batch sale logging: applies log_sale logic to a jsonb array of sales.
-- All-or-nothing: any failure raises and rolls back the whole batch.
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
-- All-or-nothing: any failure raises and rolls back the whole batch.
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

-- ------------------------------------------------------------
-- 9. Shopee order sync (see migrations/2026-07-07_shopee_sync.sql)
-- ------------------------------------------------------------

-- Shop-level OAuth tokens. Service-role only: RLS with NO policies.
CREATE TABLE public.shopee_auth (
    shop_id BIGINT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shopee_auth ENABLE ROW LEVEL SECURITY;

-- Idempotency ledger: one row per Shopee order ever logged.
CREATE TABLE public.shopee_synced_orders (
    order_sn TEXT PRIMARY KEY,
    shop_id BIGINT NOT NULL,
    items JSONB NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shopee_synced_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read on shopee_synced_orders"
  ON public.shopee_synced_orders FOR SELECT USING (true);

-- Logs one Shopee order atomically via log_sale per line item; marks
-- the order synced in the same transaction. Replay-safe.
CREATE OR REPLACE FUNCTION public.log_shopee_order(
  p_order_sn TEXT, p_shop_id BIGINT, p_sale_date DATE, p_items JSONB
)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
  v_item JSONB;
BEGIN
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
$func$;
