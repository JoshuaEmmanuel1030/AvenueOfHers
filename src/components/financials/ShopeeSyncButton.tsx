import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Pulls completed Shopee orders via the shopee-sync edge function and logs
// them as sales. If the shop isn't connected yet, starts the Shopee
// authorization flow instead (redirects back here with ?code=&shop_id=,
// which App.tsx exchanges for tokens).
export function ShopeeSyncButton({ onSynced }: { onSynced?: () => void }) {
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    const { data, error } = await supabase.functions.invoke('shopee-sync', {
      body: { action: 'auth-url', redirect: window.location.origin },
    });
    if (error || data?.error) {
      toast.error('Could not start Shopee authorization: ' + (data?.error ?? error?.message));
      return;
    }
    window.location.href = data.auth_url;
  };

  const sync = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopee-sync', {
        body: { action: 'sync', days: 7 },
      });

      if (error) {
        // A 409 means "not connected yet" — offer the auth flow instead
        let payload: any = null;
        try { payload = await (error as any).context?.json?.(); } catch { /* ignore */ }
        if (payload?.error === 'not_connected') {
          toast.info('Shopee shop not connected yet — starting authorization…');
          await connect();
          return;
        }
        throw new Error(payload?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);

      const parts = [`${data.synced} new order${data.synced !== 1 ? 's' : ''} logged`];
      if (data.skipped > 0) parts.push(`${data.skipped} already synced`);
      if (data.failed?.length > 0) parts.push(`${data.failed.length} failed`);
      if (data.failed?.length > 0 || data.unmatched_skus?.length > 0) {
        const skuNote = data.unmatched_skus?.length
          ? ` Unmatched SKUs: ${data.unmatched_skus.join(', ')} — fix these in Inventory and re-sync.`
          : '';
        toast.warning(parts.join(' · ') + skuNote, { duration: 10000 });
      } else {
        toast.success(parts.join(' · '));
      }
      if (data.synced > 0) onSynced?.();
    } catch (err: any) {
      toast.error('Shopee sync failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={sync} disabled={loading} className="border-border">
      {loading
        ? <RefreshCw className="h-4 w-4 animate-spin" />
        : <Store className="h-4 w-4" />}
      <span className={cn('ml-1.5 hidden sm:inline')}>Sync Shopee</span>
    </Button>
  );
}
