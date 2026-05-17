import React from 'react';
import { LowStockItem } from '@/lib/insights';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  items: LowStockItem[];
}

export function LowStockAlertCard({ items }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Low Stock Alerts</p>
        {items.length > 0 && (
          <span className="text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-100 px-2 py-0.5 rounded-full uppercase">
            {items.length} variant{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <AlertTriangle size={18} className="text-emerald-400" />
          </div>
          <p className="text-sm text-slate-400">All stock levels are healthy</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[280px]">
          {items.map(item => (
            <div key={item.sku} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:bg-slate-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                <p className="text-[11px] text-slate-400">{item.size} / {item.color} · <span className="font-mono">{item.sku}</span></p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className={cn(
                  'text-base font-bold',
                  item.stock_qty === 0 ? 'text-rose-500' : 'text-amber-500'
                )}>
                  {item.stock_qty}
                </p>
                <p className="text-[10px] text-slate-400">/ {item.reorder_threshold} min</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
