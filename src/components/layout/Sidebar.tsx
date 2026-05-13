import React from 'react';
import { LayoutGrid, TrendingUp, Package, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  activeTab: 'inventory' | 'financials';
  onTabChange: (tab: 'inventory' | 'financials') => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-border h-screen flex flex-col shadow-sm">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-serif font-bold tracking-tight text-primary">Avenue of Hers</h1>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">Solo Business Suite</p>
      </div>

      <nav className="flex-1 py-6">
        <button
          className={cn(
            "w-full flex items-center px-6 py-3 transition-colors font-medium border-r-4",
            activeTab === 'inventory' 
              ? "bg-secondary text-primary border-primary" 
              : "text-slate-500 hover:text-primary hover:bg-slate-50 border-transparent"
          )}
          onClick={() => onTabChange('inventory')}
        >
          <Package size={20} className="mr-3" />
          <span>Inventory</span>
        </button>
        <button
          className={cn(
            "w-full flex items-center px-6 py-3 transition-colors font-medium border-r-4",
            activeTab === 'financials' 
              ? "bg-secondary text-primary border-primary" 
              : "text-slate-500 hover:text-primary hover:bg-slate-50 border-transparent"
          )}
          onClick={() => onTabChange('financials')}
        >
          <TrendingUp size={20} className="mr-3" />
          <span>Financials</span>
        </button>
      </nav>

      <div className="p-6 border-t border-border mt-auto">
        <div className="bg-muted rounded-lg p-3 text-xs">
          <p className="font-semibold text-slate-600">Logged in as</p>
          <p className="text-slate-500">Solo Owner</p>
        </div>
      </div>
    </aside>
  );
}
