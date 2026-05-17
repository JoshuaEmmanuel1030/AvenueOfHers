import React from 'react';
import { InventoryValueData } from '@/lib/insights';

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

interface Props {
  data: InventoryValueData;
}

export function InventoryValueCard({ data }: Props) {
  const marginPct = data.totalRetailValue > 0
    ? ((data.potentialProfit / data.totalRetailValue) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col gap-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Inventory Value</p>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-sm text-slate-500">Total Units</span>
          <span className="text-lg font-bold text-slate-800">{data.totalUnits.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-sm text-slate-500">Cost Value</span>
          <span className="text-base font-semibold text-slate-700">{idr(data.totalCostValue)}</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-border">
          <span className="text-sm text-slate-500">Retail Value</span>
          <span className="text-base font-semibold text-slate-700">{idr(data.totalRetailValue)}</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-sm text-slate-500">Potential Profit</span>
          <div className="text-right">
            <p className="text-base font-bold text-emerald-600">{idr(data.potentialProfit)}</p>
            <p className="text-[10px] text-emerald-400 font-medium">{marginPct}% margin</p>
          </div>
        </div>
      </div>

      {/* Visual bar */}
      {data.totalRetailValue > 0 && (
        <div className="mt-1">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${(data.potentialProfit / data.totalRetailValue) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Cost</span>
            <span>Retail</span>
          </div>
        </div>
      )}
    </div>
  );
}
