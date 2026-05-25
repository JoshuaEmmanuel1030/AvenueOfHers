import React from 'react';
import { TrendingUp, Package, History, ChevronDown, BarChart2, ClipboardList, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'catalogue' | 'inventory' | 'stock-history' | 'insights' | 'financials' | 'kpi';

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}


export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const inventoryActive = activeTab === 'inventory' || activeTab === 'stock-history' || activeTab === 'insights';
  const [inventoryExpanded, setInventoryExpanded] = React.useState(inventoryActive);

  // Auto-expand when navigating to an inventory tab from outside
  React.useEffect(() => {
    if (inventoryActive) setInventoryExpanded(true);
  }, [inventoryActive]);

  return (
    <aside className="w-64 bg-white border-r border-border h-screen flex flex-col shadow-sm">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-serif font-bold tracking-tight text-primary">Avenue of Hers</h1>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">Solo Business Suite</p>
      </div>

      <nav className="flex-1 py-6">
        {/* Catalogue */}
        <button
          className={cn(
            'w-full flex items-center px-6 py-3 transition-colors font-medium border-r-4',
            activeTab === 'catalogue'
              ? 'bg-secondary text-primary border-primary'
              : 'text-slate-500 hover:text-primary hover:bg-slate-50 border-transparent'
          )}
          onClick={() => onTabChange('catalogue')}
        >
          <BookOpen size={20} className="mr-3" />
          <span>Catalogue</span>
        </button>

        {/* Inventory group */}
        <div>
          <button
            className={cn(
              'w-full flex items-center px-6 py-3 transition-colors font-medium border-r-4',
              inventoryActive
                ? 'bg-secondary text-primary border-primary'
                : 'text-slate-500 hover:text-primary hover:bg-slate-50 border-transparent'
            )}
            onClick={() => {
              if (inventoryActive) {
                setInventoryExpanded(e => !e);
              } else {
                setInventoryExpanded(true);
                onTabChange('inventory');
              }
            }}
          >
            <Package size={20} className="mr-3" />
            <span className="flex-1 text-left">Inventory</span>
            <ChevronDown size={14} className={cn('transition-transform', inventoryExpanded && 'rotate-180')} />
          </button>

          {inventoryExpanded && (
            <div className="ml-6 border-l border-border">
              <SubItem
                label="Products"
                active={activeTab === 'inventory'}
                onClick={() => onTabChange('inventory')}
              />
              <SubItem
                label="Stock History"
                active={activeTab === 'stock-history'}
                onClick={() => onTabChange('stock-history')}
              />
              <SubItem
                label="Insights"
                active={activeTab === 'insights'}
                onClick={() => onTabChange('insights')}
              />
            </div>
          )}
        </div>

        {/* KPI */}
        <button
          className={cn(
            'w-full flex items-center px-6 py-3 transition-colors font-medium border-r-4',
            activeTab === 'kpi'
              ? 'bg-secondary text-primary border-primary'
              : 'text-slate-500 hover:text-primary hover:bg-slate-50 border-transparent'
          )}
          onClick={() => onTabChange('kpi')}
        >
          <ClipboardList size={20} className="mr-3" />
          <span>Daily KPI</span>
        </button>

        {/* Financials */}
        <button
          className={cn(
            'w-full flex items-center px-6 py-3 transition-colors font-medium border-r-4',
            activeTab === 'financials'
              ? 'bg-secondary text-primary border-primary'
              : 'text-slate-500 hover:text-primary hover:bg-slate-50 border-transparent'
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

function SubItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center pl-4 pr-6 py-2.5 text-sm transition-colors border-r-4',
        active
          ? 'text-primary font-semibold border-primary bg-secondary/50'
          : 'text-slate-400 hover:text-primary hover:bg-slate-50 border-transparent font-medium'
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-2.5 opacity-60" />
      {label}
    </button>
  );
}
