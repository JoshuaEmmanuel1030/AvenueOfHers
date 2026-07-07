import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Shopee Open Platform v2 — SANDBOX environment (the current sandbox host;
// the older partner.test-stable.shopeemobile.com rejects new test keys with
// error_sign). Swap to https://partner.shopeemobile.com for production.
const SHOPEE_HOST = 'https://openplatform.sandbox.test-stable.shopee.sg';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// HMAC-SHA256 hex signature over the v2 base string.
async function sign(partnerKey: string, baseString: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(partnerKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(baseString));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Order date in the shop's timezone (WIB), not UTC.
function saleDateWIB(epochSeconds: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(epochSeconds * 1000)); // en-CA gives YYYY-MM-DD
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!req.headers.get('Authorization')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const partnerId = Deno.env.get('SHOPEE_PARTNER_ID');
    const partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY');
    if (!partnerId || !partnerKey) {
      throw new Error('SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const action: string = body.action;

    // ------------------------------------------------------------
    // Public-API call helper (auth endpoints): sign = partner_id + path + timestamp
    // ------------------------------------------------------------
    const publicCall = async (path: string, payload: Record<string, unknown>) => {
      const ts = Math.floor(Date.now() / 1000);
      const s = await sign(partnerKey, `${partnerId}${path}${ts}`);
      const url = `${SHOPEE_HOST}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${s}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.error) throw new Error(`Shopee ${path}: ${data.error} ${data.message ?? ''}`);
      return data;
    };

    // ------------------------------------------------------------
    // Shop-API call helper (GET): sign = partner_id + path + timestamp + access_token + shop_id
    // ------------------------------------------------------------
    const shopGet = async (
      path: string, shopId: number, accessToken: string, params: Record<string, string>,
    ) => {
      const ts = Math.floor(Date.now() / 1000);
      const s = await sign(partnerKey, `${partnerId}${path}${ts}${accessToken}${shopId}`);
      const qs = new URLSearchParams({
        partner_id: partnerId, timestamp: String(ts), sign: s,
        access_token: accessToken, shop_id: String(shopId), ...params,
      });
      const res = await fetch(`${SHOPEE_HOST}${path}?${qs}`);
      const data = await res.json();
      if (data.error) throw new Error(`Shopee ${path}: ${data.error} ${data.message ?? ''}`);
      return data;
    };

    // ============================================================
    // action: auth-url — build the shop-authorization link
    // ============================================================
    if (action === 'auth-url') {
      const redirect: string = body.redirect;
      if (!redirect) throw new Error('redirect is required');
      const path = '/api/v2/shop/auth_partner';
      const ts = Math.floor(Date.now() / 1000);
      const s = await sign(partnerKey, `${partnerId}${path}${ts}`);
      const url = `${SHOPEE_HOST}${path}?partner_id=${partnerId}&timestamp=${ts}&sign=${s}&redirect=${encodeURIComponent(redirect)}`;
      return json({ auth_url: url });
    }

    // ============================================================
    // action: exchange — code + shop_id -> tokens, stored in shopee_auth
    // ============================================================
    if (action === 'exchange') {
      const { code, shop_id } = body;
      if (!code || !shop_id) throw new Error('code and shop_id are required');
      const data = await publicCall('/api/v2/auth/token/get', {
        code, shop_id: Number(shop_id), partner_id: Number(partnerId),
      });
      const expiresAt = new Date(Date.now() + (data.expire_in - 300) * 1000).toISOString();
      const { error } = await supabase.from('shopee_auth').upsert({
        shop_id: Number(shop_id),
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return json({ connected: true, shop_id: Number(shop_id) });
    }

    // ============================================================
    // action: sync — pull recent completed orders and log them
    // ============================================================
    if (action === 'sync') {
      const days = Math.min(Number(body.days) || 7, 15); // Shopee caps the window at 15 days

      // 1. Load stored auth (single-shop assumption)
      const { data: auth, error: authError } = await supabase
        .from('shopee_auth').select('*').limit(1).maybeSingle();
      if (authError) throw authError;
      if (!auth) return json({ error: 'not_connected' }, 409);

      let accessToken = auth.access_token as string;
      const shopId = Number(auth.shop_id);

      // 2. Refresh the access token if it is (close to) expired
      if (new Date(auth.expires_at) <= new Date()) {
        const refreshed = await publicCall('/api/v2/auth/access_token/get', {
          refresh_token: auth.refresh_token, shop_id: shopId, partner_id: Number(partnerId),
        });
        accessToken = refreshed.access_token;
        const expiresAt = new Date(Date.now() + (refreshed.expire_in - 300) * 1000).toISOString();
        const { error } = await supabase.from('shopee_auth').update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq('shop_id', shopId);
        if (error) throw error;
      }

      // 3. List completed orders in the window (paginated)
      const timeTo = Math.floor(Date.now() / 1000);
      const timeFrom = timeTo - days * 86400;
      const orderSns: string[] = [];
      let cursor = '';
      do {
        const page = await shopGet('/api/v2/order/get_order_list', shopId, accessToken, {
          time_range_field: 'create_time',
          time_from: String(timeFrom),
          time_to: String(timeTo),
          page_size: '50',
          order_status: 'COMPLETED',
          ...(cursor ? { cursor } : {}),
        });
        for (const o of page.response?.order_list ?? []) orderSns.push(o.order_sn);
        cursor = page.response?.more ? page.response.next_cursor : '';
      } while (cursor);

      if (orderSns.length === 0) {
        return json({ synced: 0, skipped: 0, failed: [], unmatched_skus: [], message: `No completed orders in the last ${days} days.` });
      }

      // 4. Skip orders already in the ledger (cheap pre-filter; the RPC
      //    re-checks atomically anyway)
      const { data: already } = await supabase
        .from('shopee_synced_orders').select('order_sn').in('order_sn', orderSns);
      const alreadySet = new Set((already ?? []).map(r => r.order_sn));
      const todo = orderSns.filter(sn => !alreadySet.has(sn));

      // 5. Variant lookup by SKU
      const { data: variants, error: vError } = await supabase
        .from('product_variants').select('id, sku, cost_price');
      if (vError) throw vError;
      const bySku = new Map((variants ?? []).map(v => [v.sku, v]));

      // 6. Fetch details and log each order atomically
      let synced = 0;
      const failed: { order_sn: string; reason: string }[] = [];
      const unmatchedSkus = new Set<string>();

      for (let i = 0; i < todo.length; i += 50) {
        const batch = todo.slice(i, i + 50);
        const detail = await shopGet('/api/v2/order/get_order_detail', shopId, accessToken, {
          order_sn_list: batch.join(','),
          response_optional_fields: 'item_list,create_time,order_status',
        });

        for (const order of detail.response?.order_list ?? []) {
          const items: { variant_id: string; qty: number; revenue: number; cost_price_at_sale: number }[] = [];
          let missingSku: string | null = null;

          for (const it of order.item_list ?? []) {
            const sku = it.model_sku || it.item_sku;
            const variant = sku ? bySku.get(sku) : undefined;
            if (!variant) {
              missingSku = sku || `(no SKU on "${it.item_name}")`;
              unmatchedSkus.add(missingSku!);
              break; // skip the whole order — partial orders would corrupt totals
            }
            const qty = Number(it.model_quantity_purchased);
            const unitPrice = Number(it.model_discounted_price);
            items.push({
              variant_id: variant.id,
              qty,
              revenue: unitPrice * qty,
              cost_price_at_sale: Number(variant.cost_price),
            });
          }

          if (missingSku) {
            failed.push({ order_sn: order.order_sn, reason: `unmatched SKU: ${missingSku}` });
            continue;
          }

          const { data: result, error: logError } = await supabase.rpc('log_shopee_order', {
            p_order_sn: order.order_sn,
            p_shop_id: shopId,
            p_sale_date: saleDateWIB(order.create_time),
            p_items: items,
          });
          if (logError) {
            failed.push({ order_sn: order.order_sn, reason: logError.message });
          } else if (result === 'synced') {
            synced++;
          }
        }
      }

      return json({
        synced,
        skipped: alreadySet.size,
        failed,
        unmatched_skus: [...unmatchedSkus],
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    console.error('Error in shopee-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return json({ error: errorMessage }, 500);
  }
});
