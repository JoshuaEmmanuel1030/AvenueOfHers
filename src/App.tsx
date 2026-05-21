import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { InventoryPage } from '@/pages/Inventory';
import { FinancialsPage } from '@/pages/Financials';
import { StockHistoryPage } from '@/pages/StockHistory';
import { InsightsPage } from '@/pages/Insights';
import { KPIPage } from '@/pages/KPI';
import { Toaster } from '@/components/ui/sonner';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AlertCircle, Menu, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type Tab = 'inventory' | 'stock-history' | 'insights' | 'financials' | 'kpi';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('kpi');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const notifyDataChange = () => setDataVersion(v => v + 1);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              Please set your <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in the environment variables to use this application.
            </p>
            <div className="bg-destructive/10 p-3 rounded-md text-sm">
              <p className="font-bold mb-1">⚠️ Important:</p>
              <p>Use the <strong>anon public</strong> key from your Supabase dashboard. Do <strong>not</strong> use the <code className="bg-destructive/20 px-1 rounded">service_role</code> key, as it is blocked for browser use.</p>
            </div>
            <div className="bg-muted p-2 rounded text-xs font-mono break-all opacity-70">
              Settings &gt; API &gt; Project API keys
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-border flex items-center px-4 z-30 shadow-sm">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-serif font-bold text-primary ml-3">Avenue of Hers</h1>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on lg+, drawer on mobile */}
      <div className={cn(
        'fixed lg:relative z-50 lg:z-auto h-full transition-transform duration-200',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="relative">
          {mobileSidebarOpen && (
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden absolute top-4 right-3 z-10 p-1 rounded-md hover:bg-slate-100 text-slate-400"
            >
              <X size={16} />
            </button>
          )}
          <Sidebar
            activeTab={activeTab}
            onTabChange={tab => { setActiveTab(tab); setMobileSidebarOpen(false); }}
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-background pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 min-h-full">
          {/* Pages stay mounted after first visit — no refetch on every tab switch */}
          <div className={activeTab !== 'inventory' ? 'hidden' : ''}><InventoryPage dataVersion={dataVersion} onStockChanged={notifyDataChange} /></div>
          <div className={activeTab !== 'financials' ? 'hidden' : ''}><FinancialsPage onSaleLogged={notifyDataChange} /></div>
          <div className={activeTab !== 'stock-history' ? 'hidden' : ''}><StockHistoryPage /></div>
          <div className={activeTab !== 'insights' ? 'hidden' : ''}><InsightsPage dataVersion={dataVersion} /></div>
          <div className={activeTab !== 'kpi' ? 'hidden' : ''}><KPIPage /></div>
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
