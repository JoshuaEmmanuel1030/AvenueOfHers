-- Run this in Supabase SQL Editor.
-- If you ran the old schema, run the DROP statements first.

DROP TABLE IF EXISTS public.sales;
DROP TABLE IF EXISTS public.product_variants;
DROP TABLE IF EXISTS public.products;

-- Products table — represents a style/design (e.g. "Floral Midi Dress")
CREATE TABLE public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
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
    stock_qty INTEGER NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sales table — references a specific variant, not just a product
-- ON DELETE RESTRICT prevents deleting a variant that has sales history
CREATE TABLE public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE RESTRICT NOT NULL,
    qty INTEGER NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('Shopee', 'TikTok', 'Other')),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    revenue NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
-- Stock movement audit log
CREATE TABLE public.stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    qty INTEGER NOT NULL,
    platform TEXT CHECK (platform IN ('Shopee', 'TikTok', 'Instagram', 'Manual')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

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
BEGIN
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
  SELECT variant_id, qty INTO v_variant_id, v_qty FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  DELETE FROM public.sales WHERE id = p_sale_id;
  UPDATE public.product_variants SET stock_qty = stock_qty + v_qty WHERE id = v_variant_id;
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
