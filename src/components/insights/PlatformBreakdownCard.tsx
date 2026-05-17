import React, { useState } from 'react';
import { PlatformData } from '@/lib/insights';
import { cn } from '@/lib/utils';

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const PLATFORM_COLORS: Record<string, string> = {
  Shopee: 'bg-orange-400',
  TikTok: 'bg-slate-800',
  Instagram: 'bg-purple-400',
  Other: 'bg-slate-400',
};

interface Props {
  data: PlatformData[];
}

export function PlatformBreakdownCard({ data }: Props) {
  const [metric, setMetric] = useState<'units' | 'revenue'>('units');

  const total = data.reduce((s, d) => s + (metric === 'units' ? d.units : d.revenue), 0) || 1;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Platform Breakdown</p>
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

      {data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-sm text-slate-400">No sales data yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
            {data.map(d => {
              const val = metric === 'units' ? d.units : d.revenue;
              const pct = (val / total) * 100;
              return (
                <div
                  key={d.platform}
                  className={cn('h-full transition-all duration-500', PLATFORM_COLORS[d.platform] ?? 'bg-slate-400')}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>

          <div className="space-y-2.5">
            {data.map(d => {
              const val = metric === 'units' ? d.units : d.revenue;
              const pct = ((val / total) * 100).toFixed(1);
              return (
                <div key={d.platform} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', PLATFORM_COLORS[d.platform] ?? 'bg-slate-400')} />
                    <span className="text-sm text-slate-700 font-medium">{d.platform}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-800">
                      {metric === 'units' ? `${d.units} units` : idr(d.revenue)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1.5">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
