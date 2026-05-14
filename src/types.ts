export interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  color: string;
  sku: string;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  reorder_threshold: number;
  created_at: string;
}

export interface ProductWithVariants extends Product {
  product_variants: ProductVariant[];
}

export interface Sale {
  id: string;
  variant_id: string;
  qty: number;
  platform: 'Shopee' | 'TikTok' | 'Other';
  sale_date: string;
  revenue: number;
  created_at: string;
}

export type SaleWithVariant = Sale & {
  product_variants: ProductVariant & {
    products: Product;
  };
};
