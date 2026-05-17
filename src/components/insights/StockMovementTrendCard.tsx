import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendDay } from '@/lib/insights';

interface Props {
  data: TrendDay[];
}

export function StockMovementTrendCard({ data }: Props) {
  const hasData = data.some(d => d.in > 0 || d.out > 0);

  // Show every 5th label to avoid crowding
  const tickFormatter = (_: string, index: number) => (index % 5 === 0 ? data[index]?.date ?? '' : '');

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Stock Movement Trend</p>
        <span className="text-[10px] text-slate-400">Last 30 days</span>
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-sm text-slate-400">No stock movements in the last 30 days</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={tickFormatter}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              labelStyle={{ fontWeight: 600, color: '#475569' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {value === 'in' ? 'Stock In' : 'Stock Out'}
                </span>
              )}
            />
            <Area type="monotone" dataKey="in" stroke="#10b981" strokeWidth={2} fill="url(#gradIn)" dot={false} />
            <Area type="monotone" dataKey="out" stroke="#f43f5e" strokeWidth={2} fill="url(#gradOut)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
