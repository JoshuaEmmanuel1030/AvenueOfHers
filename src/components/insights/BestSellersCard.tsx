import React, { useState } from 'react';
import { BestSellerItem } from '@/lib/insights';
import { cn } from '@/lib/utils';

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

interface Props {
  items: BestSellerItem[];
}

export function BestSellersCard({ items }: Props) {
  const [metric, setMetric] = useState<'units' | 'revenue'>('units');

  const maxVal = items.reduce((m, i) => Math.max(m, metric === 'units' ? i.units : i.revenue), 1);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Best Sellers</p>
        <div className="flex gap-1">
          {(['units', 'revenue'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors',
                metric === m ? 'bg-primary text-white' : 'text-slate-400 hover:text-slate-600'
              )}
            >
              {m === 'units' ? 'Units' : 'Revenue'}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-sm text-slate-400">No sales data yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const val = metric === 'units' ? item.units : item.revenue;
            const pct = (val / maxVal) * 100;
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-medium text-slate-800">{item.productName}</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">{item.variantLabel}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700 ml-2 flex-shrink-0">
                    {metric === 'units' ? `${val} units` : idr(val)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
