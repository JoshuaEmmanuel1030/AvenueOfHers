import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { InventoryPage } from '@/pages/Inventory';
import { FinancialsPage } from '@/pages/Financials';
import { StockHistoryPage } from '@/pages/StockHistory';
import { InsightsPage } from '@/pages/Insights';
import { KPIPage } from '@/pages/KPI';
import { Toaster } from '@/components/ui/sonner';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Tab = 'inventory' | 'stock-history' | 'insights' | 'financials' | 'kpi';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('inventory');

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
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-7xl mx-auto px-8 py-10 min-h-full">
          {activeTab === 'inventory' && <InventoryPage />}
          {activeTab === 'financials' && <FinancialsPage />}
          {activeTab === 'stock-history' && <StockHistoryPage />}
          {activeTab === 'insights' && <InsightsPage />}
          {activeTab === 'kpi' && <KPIPage />}
        </div>
      </main>

      <Toaster position="top-right" />
    </div>
  );
}
