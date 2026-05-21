import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductWithVariants, SaleWithVariant, StockMovement } from '@/types';
import {
  getStockHealth, getInventoryValue, getLowStockItems,
  getBestSellers, getPlatformBreakdown, getStockTrend
} from '@/lib/insights';
import { StockHealthCard } from '@/components/insights/StockHealthCard';
import { InventoryValueCard } from '@/components/insights/InventoryValueCard';
import { LowStockAlertCard } from '@/components/insights/LowStockAlertCard';
import { BestSellersCard } from '@/components/insights/BestSellersCard';
import { PlatformBreakdownCard } from '@/components/insights/PlatformBreakdownCard';
import { StockMovementTrendCard } from '@/components/insights/StockMovementTrendCard';
import { BulkStockModal } from '@/components/inventory/BulkStockModal';

export function InsightsPage({ dataVersion = 0 }: { dataVersion?: number }) {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [sales, setSales] = useState<SaleWithVariant[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockOpen, setRestockOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [productsRes, salesRes, movementsRes] = await Promise.all([
        supabase.from('products').select('*, product_variants(*)').eq('is_archived', false),
        supabase.from('sales').select('*, product_variants(*, products(*))').order('created_at', { ascending: false }),
        supabase.from('stock_movements').select('*').order('created_at', { ascending: false }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (salesRes.error) throw salesRes.error;
      if (movementsRes.error) throw movementsRes.error;

      setProducts((productsRes.data as any) || []);
      setSales((salesRes.data as any) || []);
      setMovements((movementsRes.data as any) || []);
    } catch (err: any) {
      toast.error('Failed to load insights: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [dataVersion]);

  const totalVariants = useMemo(
    () => products.reduce((s, p) => s + p.product_variants.length, 0),
    [products]
  );
  const stockHealth = useMemo(() => getStockHealth(products), [products]);
  const inventoryValue = useMemo(() => getInventoryValue(products), [products]);
  const lowStockItems = useMemo(() => getLowStockItems(products), [products]);
  const bestSellers = useMemo(() => getBestSellers(sales), [sales]);
  const platformData = useMemo(() => getPlatformBreakdown(sales), [sales]);
  const trendData = useMemo(() => getStockTrend(movements), [movements]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white h-20">
        <h2 className="text-xl font-semibold text-slate-700">Insights</h2>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="border-border">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-border shadow-sm p-5 animate-pulse">
              <div className="h-2.5 w-24 bg-slate-100 rounded mb-4" />
              <div className="h-36 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <StockHealthCard data={stockHealth} totalVariants={totalVariants} />
          <InventoryValueCard data={inventoryValue} />
          <LowStockAlertCard items={lowStockItems} onRestock={() => setRestockOpen(true)} />
          <BestSellersCard items={bestSellers} />
          <PlatformBreakdownCard data={platformData} />
          <StockMovementTrendCard data={trendData} />
        </div>
      )}
      <BulkStockModal
        open={restockOpen}
        onClose={() => setRestockOpen(false)}
        onSuccess={fetchAll}
        products={products}
        initialType="in"
      />
    </div>
  );
}
