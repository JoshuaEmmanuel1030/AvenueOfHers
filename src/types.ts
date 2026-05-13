export interface Product {
  id: string;
  name: string;
  sku: string;
  variant: string;
  stock_qty: number;
  cost_price: number;
  sell_price: number;
  reorder_threshold: number;
  created_at: string;
}

export interface Sale {
  id: string;
  product_id: string;
  qty: number;
  platform: 'Shopee' | 'TikTok' | 'Other';
  sale_date: string;
  revenue: number;
  created_at: string;
  product?: Product;
}

export type SalesWithProduct = Sale & {
  products: Product;
};
