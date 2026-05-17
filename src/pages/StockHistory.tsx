import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowUpCircle, ArrowDownCircle, History } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface MovementRow {
  id: string;
  type: 'in' | 'out';
  qty: number;
  platform: string | null;
  note: string | null;
  created_at: string;
  product_variants: {
    size: string;
    color: string;
    sku: string;
    products: { name: string };
  };
}

const PLATFORM_STYLES: Record<string, string> = {
  Shopee: 'bg-orange-50 text-orange-700 border-orange-100',
  TikTok: 'bg-slate-900 text-white border-slate-900',
  Instagram: 'bg-purple-50 text-purple-700 border-purple-100',
  Manual: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function StockHistoryPage() {
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*, product_variants(size, color, sku, products(name))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements((data as any) || []);
    } catch (error: any) {
      toast.error('Failed to load stock history: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMovements(); }, []);

  const filtered = filter === 'all' ? movements : movements.filter(m => m.type === filter);

  const totalIn = movements.filter(m => m.type === 'in').reduce((s, m) => s + m.qty, 0);
  const totalOut = movements.filter(m => m.type === 'out').reduce((s, m) => s + m.qty, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white h-20">
        <h2 className="text-xl font-semibold text-slate-700">Stock History</h2>
        <Button variant="outline" size="sm" onClick={fetchMovements} disabled={loading} className="border-border">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Movements</p>
          <p className="text-xl font-bold text-slate-800">{movements.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">Total Stock In</p>
          <p className="text-xl font-bold text-emerald-600">+{totalIn}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
          <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mb-1">Total Stock Out</p>
          <p className="text-xl font-bold text-rose-500">−{totalOut}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Filter tabs */}
        <div className="p-4 border-b bg-slate-50 flex items-center gap-2">
          <History className="text-slate-400" size={16} />
          <div className="flex gap-1 ml-auto">
            {(['all', 'in', 'out'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-colors',
                  filter === f
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-slate-600'
                )}
              >
                {f === 'all' ? 'All' : f === 'in' ? 'Stock In' : 'Stock Out'}
              </button>
            ))}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-slate-50 border-border">
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Date & Time</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Product / Variant</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-center">Type</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-center">Qty</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Platform</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto opacity-20" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <History size={40} className="opacity-20" />
                    <p>No stock movements yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(m => {
                const variant = m.product_variants;
                return (
                  <TableRow key={m.id} className="hover:bg-slate-50 transition-colors border-border">
                    <TableCell className="px-6 py-4 text-slate-500 text-sm">
                      {format(new Date(m.created_at), 'MMM d, yyyy · h:mm a')}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <p className="font-medium text-slate-800">{variant?.products?.name ?? '—'}</p>
                      <p className="text-[11px] text-slate-400">
                        {variant ? `${variant.size} / ${variant.color}` : '—'}
                        {variant?.sku && <span className="font-mono ml-2">· {variant.sku}</span>}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      {m.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                          <ArrowUpCircle size={14} /> In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-semibold text-xs">
                          <ArrowDownCircle size={14} /> Out
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-center font-mono font-medium text-slate-800">
                      <span className={m.type === 'in' ? 'text-emerald-600' : 'text-rose-500'}>
                        {m.type === 'in' ? '+' : '−'}{m.qty}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      {m.platform ? (
                        <span className={cn(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                          PLATFORM_STYLES[m.platform] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                        )}>
                          {m.platform}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-slate-500 italic">
                      {m.note ?? <span className="text-slate-300 not-italic">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="bg-slate-50 px-6 py-3 border-t border-border text-xs text-slate-400">
          {filtered.length} movement{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
