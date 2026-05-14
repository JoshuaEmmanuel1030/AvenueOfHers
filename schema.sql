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
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on product_variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
