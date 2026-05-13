import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sale, SalesWithProduct } from '@/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  History, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { LogSaleModal } from '@/components/financials/LogSaleModal';
import { cn } from '@/lib/utils';

export function FinancialsPage() {
  const [sales, setSales] = useState<SalesWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSales = async () => {
    if (!supabase) {
      toast.error('Supabase client not initialized. Check your secrets.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Joining with products to get cost_price for margin calculations
      const { data, error } = await supabase
        .from('sales')
        .select('*, products(*)')
        .order('sale_date', { ascending: false });

      if (error) throw error;
      setSales((data as any) || []);
    } catch (error: any) {
      console.error('Financials Fetch Error:', error);
      toast.error('Failed to load sales: ' + (error.message || 'Check if the "sales" table exists in Supabase.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const totalRevenue = sales.reduce((sum, sale) => sum + sale.revenue, 0);
  const totalCOGS = sales.reduce((sum, sale) => sum + (sale.products?.cost_price || 0) * sale.qty, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const marginPercentage = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'Shopee': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'TikTok': return 'bg-black text-white border-black';
      case 'Other': return 'bg-stone-100 text-stone-700 border-stone-200';
      default: return 'bg-stone-100';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white h-20">
        <div>
          <h2 className="text-xl font-semibold text-slate-700">Financial Performance</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchSales} disabled={loading} className="border-border">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white hover:bg-primary/90 font-medium shadow-sm transition-all" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Log Sale
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard 
          title="Total Revenue" 
          value={formatIDR(totalRevenue)} 
        />
        <SummaryCard 
          title="Total COGS" 
          value={formatIDR(totalCOGS)} 
        />
        <SummaryCard 
          title="Gross Profit" 
          value={formatIDR(grossProfit)} 
          isProfit
        />
        <SummaryCard 
          title="Margin %" 
          value={`${marginPercentage.toFixed(1)}%`} 
        />
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <History className="text-slate-400" size={18} />
            <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Sales activity log</h3>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-slate-50 border-border">
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Date</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Product / SKU</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-center">Qty</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Platform</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-right">Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto opacity-20" />
                </TableCell>
              </TableRow>
            ) : sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center text-slate-400 p-8">
                  <div className="flex flex-col items-center gap-3">
                    <History size={40} className="opacity-20" />
                    <p>No sales activity logged yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-slate-50 transition-colors border-border">
                  <TableCell className="px-6 py-4 text-slate-500 text-sm">
                    {format(new Date(sale.sale_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{sale.products?.name || 'Unknown Product'}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{sale.products?.sku}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <span className="font-mono font-medium text-slate-700">
                      {sale.qty}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border shadow-none",
                      sale.platform === 'Shopee' && "bg-orange-50 text-orange-700 border-orange-100",
                      sale.platform === 'TikTok' && "bg-slate-900 text-white border-slate-900",
                      sale.platform === 'Other' && "bg-blue-50 text-blue-700 border-blue-100"
                    )}>
                      {sale.platform}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right font-bold text-slate-800">
                    {formatIDR(sale.revenue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LogSaleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchSales} 
      />
    </div>
  );
}

function SummaryCard({ title, value, isProfit }: { title: string, value: string, isProfit?: boolean }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">{title}</p>
      <p className={cn(
        "text-xl font-bold tracking-tight",
        isProfit ? "text-primary" : "text-slate-800"
      )}>
        {value}
      </p>
    </div>
  );
}
