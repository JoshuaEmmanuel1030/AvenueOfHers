import React from 'react';
import { ShoppingBag, TrendingUp, Package } from 'lucide-react';

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

interface Props {
  orderCount: number;
  aov: number;
  totalUnits: number;
}

export function StatsRow({ orderCount, aov, totalUnits }: Props) {
  const stats = [
    { label: 'Orders This Month', value: String(orderCount), sub: 'transactions', icon: ShoppingBag, color: 'text-primary' },
    { label: 'Avg Order Value', value: idr(aov), sub: 'per transaction', icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Units Sold', value: String(totalUnits), sub: 'this month', icon: Package, color: 'text-amber-500' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-start gap-3">
          <div className={`mt-0.5 ${s.color} opacity-70`}>
            <s.icon size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{s.label}</p>
            <p className="text-xl font-bold text-slate-800">{s.value}</p>
            <p className="text-[10px] text-slate-400">{s.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
