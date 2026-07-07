import { ProductWithVariants, SaleWithVariant, StockMovement } from '@/types';
import { format, subDays, startOfDay } from 'date-fns';

export interface StockHealthData {
  name: string;
  value: number;
  fill: string;
}

export function getStockHealth(products: ProductWithVariants[]): StockHealthData[] {
  let healthy = 0, low = 0, out = 0;
  for (const p of products) {
    for (const v of p.product_variants) {
      if (v.stock_qty === 0) out++;
      else if (v.stock_qty <= v.reorder_threshold) low++;
      else healthy++;
    }
  }
  return [
    { name: 'Healthy', value: healthy, fill: '#10b981' },
    { name: 'Low Stock', value: low, fill: '#f59e0b' },
    { name: 'Out of Stock', value: out, fill: '#f43f5e' },
  ];
}

export interface InventoryValueData {
  totalCostValue: number;
  totalRetailValue: number;
  totalUnits: number;
  potentialProfit: number;
}

export function getInventoryValue(products: ProductWithVariants[]): InventoryValueData {
  let totalCostValue = 0, totalRetailValue = 0, totalUnits = 0;
  for (const p of products) {
    for (const v of p.product_variants) {
      totalCostValue += v.cost_price * v.stock_qty;
      totalRetailValue += v.sell_price * v.stock_qty;
      totalUnits += v.stock_qty;
    }
  }
  return { totalCostValue, totalRetailValue, totalUnits, potentialProfit: totalRetailValue - totalCostValue };
}

export interface LowStockItem {
  sku: string;
  productName: string;
  size: string;
  color: string;
  stock_qty: number;
  reorder_threshold: number;
}

export function getLowStockItems(products: ProductWithVariants[]): LowStockItem[] {
  const items: LowStockItem[] = [];
  for (const p of products) {
    for (const v of p.product_variants) {
      // Low stock only — zero stock is its own category (matches getStockHealth & Inventory page)
      if (v.stock_qty > 0 && v.stock_qty <= v.reorder_threshold) {
        items.push({
          sku: v.sku,
          productName: p.name,
          size: v.size,
          color: v.color,
          stock_qty: v.stock_qty,
          reorder_threshold: v.reorder_threshold,
        });
      }
    }
  }
  return items.sort((a, b) => a.stock_qty - b.stock_qty);
}

export interface BestSellerItem {
  productName: string;
  variantLabel: string;
  units: number;
  revenue: number;
}

export function getBestSellers(sales: SaleWithVariant[]): BestSellerItem[] {
  const map = new Map<string, BestSellerItem>();
  for (const s of sales) {
    const v = s.product_variants;
    const key = v.id ?? s.variant_id;
    const label = `${v.size} / ${v.color}`;
    const name = v.products?.name ?? '—';
    const existing = map.get(key);
    if (existing) {
      existing.units += s.qty;
      existing.revenue += s.revenue;
    } else {
      map.set(key, { productName: name, variantLabel: label, units: s.qty, revenue: s.revenue });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.units - a.units).slice(0, 8);
}

export interface PlatformData {
  platform: string;
  units: number;
  revenue: number;
}

export function getPlatformBreakdown(sales: SaleWithVariant[]): PlatformData[] {
  const map = new Map<string, PlatformData>();
  for (const s of sales) {
    const p = s.platform ?? 'Other';
    const existing = map.get(p);
    if (existing) {
      existing.units += s.qty;
      existing.revenue += s.revenue;
    } else {
      map.set(p, { platform: p, units: s.qty, revenue: s.revenue });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.units - a.units);
}

export interface TrendDay {
  date: string;
  in: number;
  out: number;
}

export function getStockTrend(movements: StockMovement[], days = 30): TrendDay[] {
  // Pre-index by local-time day key: O(n) pass instead of O(n*m) nested filter per day.
  // created_at is a timestamptz — bucket in local time to match the day keys below.
  const byDate = new Map<string, { in: number; out: number }>();
  for (const m of movements) {
    const prefix = format(new Date(m.created_at), 'yyyy-MM-dd');
    const entry = byDate.get(prefix) ?? { in: 0, out: 0 };
    if (m.type === 'in') entry.in += m.qty;
    else entry.out += m.qty;
    byDate.set(prefix, entry);
  }

  const result: TrendDay[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(subDays(now, i));
    const datePrefix = format(day, 'yyyy-MM-dd');
    const dayData = byDate.get(datePrefix) ?? { in: 0, out: 0 };
    result.push({ date: format(day, 'MMM d'), in: dayData.in, out: dayData.out });
  }
  return result;
}
