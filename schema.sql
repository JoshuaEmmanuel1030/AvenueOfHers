-- Run this SQL in your Supabase SQL Editor to create the necessary tables.

-- Create Products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    variant TEXT,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    sell_price NUMERIC NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Sales table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    qty INTEGER NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('Shopee', 'TikTok', 'Other')),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    revenue NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Optional, but recommended for security if you add auth later)
-- For now, we'll create policies that allow all access if you want it to be public
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
