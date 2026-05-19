import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SaleWithVariant } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, History, RefreshCw, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, startOfWeek } from 'date-fns';
import { LogSaleModal } from '@/components/financials/LogSaleModal';
import { BulkLogSaleModal } from '@/components/financials/BulkLogSaleModal';
import { cn } from '@/lib/utils';
import { ProductWithVariants } from '@/types';

const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export function FinancialsPage() {
  const [sales, setSales] = useState<SaleWithVariant[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [period, setPeriod] = useState<'month' | 'week' | 'all'>('month');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [salesRes, productsRes] = await Promise.all([
        supabase.from('sales').select('*, product_variants(*, products(*))').order('sale_date', { ascending: false }),
        supabase.from('products').select('*, product_variants(*)').eq('is_archived', false).order('name'),
      ]);
      if (salesRes.error) throw salesRes.error;
      if (productsRes.error) throw productsRes.error;
      setSales((salesRes.data as any) || []);
      setProducts((productsRes.data as any) || []);
    } catch (error: any) {
      toast.error('Failed to load financials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const now = new Date();
  const periodCutoff = period === 'month' ? startOfMonth(now) : period === 'week' ? startOfWeek(now, { weekStartsOn: 1 }) : null;
  const periodSales = periodCutoff
    ? sales.filter(s => new Date(s.sale_date) >= periodCutoff)
    : sales;
  const displayedSales = platformFilter === 'all'
    ? periodSales
    : periodSales.filter(s => s.platform === platformFilter);

  const platformOptions = ['all', ...Array.from(new Set(periodSales.map(s => s.platform).filter(Boolean)))];

  const totalRevenue = displayedSales.reduce((sum, s) => sum + s.revenue, 0);
  const totalCOGS = displayedSales.reduce((sum, s) => sum + s.cost_price_at_sale * s.qty, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const PERIODS = [
    { key: 'month', label: 'This Month' },
    { key: 'week', label: 'This Week' },
    { key: 'all', label: 'All Time' },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white min-h-20 py-4">
        <h2 className="text-xl font-semibold text-slate-700">Financial Performance</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden h-9">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'px-3 text-[11px] font-bold uppercase transition-colors border-r border-border last:border-r-0',
                  period === p.key ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="border-border">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border font-medium"
            onClick={() => setIsBulkOpen(true)}
          >
            <Layers size={15} /> Bulk Log
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white hover:bg-primary/90 font-medium shadow-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> Log Sale
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Total Revenue" value={formatIDR(totalRevenue)} />
        <SummaryCard title="Total COGS" value={formatIDR(totalCOGS)} />
        <SummaryCard title="Gross Profit" value={formatIDR(grossProfit)} highlight />
        <SummaryCard title="Margin %" value={`${margin.toFixed(1)}%`} />
      </div>

      {/* Sales Log */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-x-auto">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <History className="text-slate-400" size={18} />
            <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Sales Activity Log</h3>
          </div>
          {platformOptions.length > 2 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {platformOptions.map(p => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border transition-colors',
                    platformFilter === p
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-500 border-border hover:bg-slate-100'
                  )}
                >
                  {p === 'all' ? 'All Platforms' : p}
                </button>
              ))}
            </div>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-slate-50 border-border">
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Date</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Product / Variant</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-center">Qty</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Platform</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-right">Revenue</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="h-4 w-36 bg-slate-100 rounded mb-1.5" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </TableCell>
                    <TableCell className="px-6 py-4"><div className="h-4 w-6 bg-slate-100 rounded mx-auto" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-5 w-16 bg-slate-100 rounded-full" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded ml-auto" /></TableCell>
                    <TableCell className="px-6 py-4"><div className="h-4 w-14 bg-slate-100 rounded ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : displayedSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <History size={40} className="opacity-20" />
                    <p>{sales.length === 0 ? 'No sales logged yet.' : `No sales in ${PERIODS.find(p => p.key === period)?.label.toLowerCase()}.`}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedSales.map(sale => {
                const variant = sale.product_variants;
                const product = variant?.products;
                return (
                  <TableRow key={sale.id} className="hover:bg-slate-50 transition-colors border-border">
                    <TableCell className="px-6 py-4 text-slate-500 text-sm">
                      {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <p className="font-medium text-slate-800">{product?.name ?? '—'}</p>
                      <p className="text-[11px] text-slate-400">
                        {variant ? `${variant.size} / ${variant.color}` : '—'}
                        {variant?.sku && <span className="font-mono ml-2">· {variant.sku}</span>}
                      </p>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center font-mono font-medium text-slate-700">{sale.qty}</TableCell>
                    <TableCell className="px-6 py-4">
                      <span className={cn(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                        sale.platform === 'Shopee' && 'bg-orange-50 text-orange-700 border-orange-100',
                        sale.platform === 'TikTok' && 'bg-slate-900 text-white border-slate-900',
                        sale.platform === 'Other' && 'bg-blue-50 text-blue-700 border-blue-100'
                      )}>
                        {sale.platform}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right font-bold text-slate-800">{formatIDR(sale.revenue)}</TableCell>
                    <TableCell className="px-6 py-4 text-right text-sm font-medium">
                      {(() => {
                        const cogs = sale.cost_price_at_sale * sale.qty;
                        const m = sale.revenue > 0 ? ((sale.revenue - cogs) / sale.revenue) * 100 : 0;
                        return (
                          <span className={cn(m >= 40 ? 'text-emerald-600' : m >= 20 ? 'text-amber-600' : 'text-rose-500')}>
                            {m.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LogSaleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchAll} />
      <BulkLogSaleModal open={isBulkOpen} onClose={() => setIsBulkOpen(false)} onSuccess={fetchAll} products={products} />
    </div>
  );
}

function SummaryCard({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{title}</p>
      <p className={cn('text-xl font-bold tracking-tight', highlight ? 'text-primary' : 'text-slate-800')}>{value}</p>
    </div>
  );
}
