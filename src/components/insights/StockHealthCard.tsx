import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { StockHealthData } from '@/lib/insights';

interface Props {
  data: StockHealthData[];
  totalVariants: number;
}

export function StockHealthCard({ data, totalVariants }: Props) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Stock Health</p>
      <p className="text-sm text-slate-500 mb-4">{totalVariants} total variants</p>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [value, name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span style={{ fontSize: 11, color: '#64748b' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {data.map(d => (
          <div key={d.name} className="text-center">
            <p className="text-lg font-bold" style={{ color: d.fill }}>{d.value}</p>
            <p className="text-[10px] text-slate-400 font-medium">{d.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
