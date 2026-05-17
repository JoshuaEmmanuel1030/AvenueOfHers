import React from 'react';
import { Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDaysInMonth, getDate, getMonth, getYear } from 'date-fns';

const idr = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

interface Props {
  revenue: number;
  target: number;
  onSetTarget: () => void;
}

export function MonthlyTargetCard({ revenue, target, onSetTarget }: Props) {
  const now = new Date();
  const dayOfMonth = getDate(now);
  const daysInMonth = getDaysInMonth(now);
  const dayProgress = dayOfMonth / daysInMonth;
  const revenueProgress = target > 0 ? Math.min(revenue / target, 1) : 0;
  const pct = (revenueProgress * 100).toFixed(0);
  const isOnTrack = target === 0 || revenueProgress >= dayProgress * 0.9;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly Sales Target</p>
          {target === 0 && (
            <p className="text-xs text-slate-400 mt-0.5">No target set yet</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {target > 0 && (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${isOnTrack ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
              {isOnTrack ? 'On Track' : 'Behind'}
            </span>
          )}
          <span className="text-sm font-bold text-primary">{pct}% achieved</span>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-slate-800">{idr(revenue)}</span>
        {target > 0 && (
          <span className="text-sm text-slate-400">/ {idr(target)}</span>
        )}
      </div>

      <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isOnTrack ? 'bg-emerald-400' : 'bg-rose-400'}`}
          style={{ width: `${revenueProgress * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Day {dayOfMonth} of {daysInMonth}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onSetTarget}
          className="h-7 text-[11px] border-border gap-1.5"
        >
          <Target size={12} />
          {target > 0 ? 'Update Target' : 'Set Target'}
        </Button>
      </div>
    </div>
  );
}
