export interface Product {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  collection: string | null;
  available_sizes: string[];
  available_colors: string[];
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
  cost_price_at_sale: number;
  created_at: string;
}

export type SaleWithVariant = Sale & {
  product_variants: ProductVariant & {
    products: Product;
  };
};

export interface StockMovement {
  id: string;
  variant_id: string;
  type: 'in' | 'out';
  qty: number;
  platform: 'Shopee' | 'TikTok' | 'Instagram' | 'Manual' | null;
  note: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string | null;
  avatar_color: string;
  created_at: string;
}

export type TaskStatus = 'pending' | 'approved' | 'review' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  amount: number | null;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

export type TaskWithMember = Task & {
  team_members: TeamMember | null;
};

export interface MonthlyTarget {
  id: string;
  year: number;
  month: number;
  revenue_target: number;
}
