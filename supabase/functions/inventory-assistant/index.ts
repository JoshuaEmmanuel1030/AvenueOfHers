import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SALES_WINDOW_DAYS = 90;

const fmtIDR = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Single-owner app with no user accounts: the platform's verify_jwt gate
    // validates the anon-key JWT; we only require the header to be present.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message } = await req.json();
    if (!message) {
      throw new Error('Message is required');
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SALES_WINDOW_DAYS);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    const [productsRes, salesRes, movementsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, collection, is_archived, product_variants(id, size, color, sku, cost_price, sell_price, stock_qty, reorder_threshold)')
        .eq('is_archived', false)
        .order('name'),
      supabase
        .from('sales')
        .select('variant_id, qty, platform, sale_date, revenue, cost_price_at_sale, product_variants(size, color, sku, products(name))')
        .gte('sale_date', cutoffDate)
        .order('sale_date', { ascending: false })
        .limit(1000),
      supabase
        .from('stock_movements')
        .select('type, qty, platform, note, created_at, product_variants(size, color, sku, products(name))')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (productsRes.error) {
      console.error('Error fetching products:', productsRes.error);
      throw new Error('Failed to fetch inventory data');
    }
    if (salesRes.error) {
      console.error('Error fetching sales:', salesRes.error);
      throw new Error('Failed to fetch sales data');
    }
    if (movementsRes.error) {
      console.error('Error fetching stock movements:', movementsRes.error);
    }

    const products = productsRes.data ?? [];
    const sales = salesRes.data ?? [];
    const movements = movementsRes.data ?? [];

    // ---------------------------------------------------------------
    // Per-variant sales aggregation (90-day window)
    // ---------------------------------------------------------------
    const variantSales: Record<string, { units: number; revenue: number }> = {};
    for (const s of sales) {
      if (!variantSales[s.variant_id]) variantSales[s.variant_id] = { units: 0, revenue: 0 };
      variantSales[s.variant_id].units += s.qty;
      variantSales[s.variant_id].revenue += s.revenue;
    }

    // ---------------------------------------------------------------
    // Inventory context: every active product with its variants,
    // stock status, prices, and estimated days-until-stockout.
    // ---------------------------------------------------------------
    let inventoryContext = 'CURRENT INVENTORY (all active products and variants):\n';
    let totalCostValue = 0;
    let totalRetailValue = 0;
    const lowStock: string[] = [];
    const outOfStock: string[] = [];

    for (const p of products) {
      const variants = p.product_variants ?? [];
      if (variants.length === 0) {
        inventoryContext += `\n${p.name}${p.collection ? ` [${p.collection}]` : ''}: no variants yet\n`;
        continue;
      }
      inventoryContext += `\n${p.name}${p.collection ? ` [${p.collection}]` : ''}:\n`;
      for (const v of variants) {
        totalCostValue += v.cost_price * v.stock_qty;
        totalRetailValue += v.sell_price * v.stock_qty;

        const label = `${p.name} ${v.size}/${v.color} (SKU ${v.sku})`;
        let status = 'OK';
        if (v.stock_qty === 0) {
          status = 'OUT OF STOCK';
          outOfStock.push(label);
        } else if (v.stock_qty <= v.reorder_threshold) {
          status = `LOW (threshold ${v.reorder_threshold})`;
          lowStock.push(`${label} — ${v.stock_qty} left`);
        }

        const sold = variantSales[v.id];
        let velocity = '';
        if (sold && sold.units > 0) {
          const avgDaily = sold.units / SALES_WINDOW_DAYS;
          const daysLeft = v.stock_qty > 0 ? Math.round(v.stock_qty / avgDaily) : 0;
          velocity = `, sold ${sold.units} in last ${SALES_WINDOW_DAYS}d${v.stock_qty > 0 ? ` (~${daysLeft} days of stock left)` : ''}`;
        }

        inventoryContext += `  - ${v.size} / ${v.color} (SKU ${v.sku}): ${v.stock_qty} pcs [${status}], cost ${fmtIDR(v.cost_price)}, sell ${fmtIDR(v.sell_price)}${velocity}\n`;
      }
    }

    inventoryContext += `\nINVENTORY VALUE: ${fmtIDR(totalCostValue)} at cost, ${fmtIDR(totalRetailValue)} at retail.\n`;
    inventoryContext += `OUT OF STOCK (${outOfStock.length}): ${outOfStock.length ? outOfStock.join('; ') : 'none'}\n`;
    inventoryContext += `LOW STOCK (${lowStock.length}): ${lowStock.length ? lowStock.join('; ') : 'none'}\n`;

    // ---------------------------------------------------------------
    // Sales analytics context (90-day window)
    // ---------------------------------------------------------------
    const variantLabel = (pv: any) =>
      pv ? `${pv.products?.name ?? 'Unknown'} ${pv.size}/${pv.color}` : 'Unknown variant';

    const totalRevenue = sales.reduce((s, x) => s + x.revenue, 0);
    const totalCOGS = sales.reduce((s, x) => s + x.cost_price_at_sale * x.qty, 0);
    const totalUnits = sales.reduce((s, x) => s + x.qty, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const margin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

    let salesContext = `\nSALES (last ${SALES_WINDOW_DAYS} days, ${sales.length} transactions):\n`;
    salesContext += `- Total: ${totalUnits} units, revenue ${fmtIDR(totalRevenue)}, COGS ${fmtIDR(totalCOGS)}, gross profit ${fmtIDR(grossProfit)} (${margin}% margin)\n`;
    salesContext += `- Note: COGS uses the cost price recorded at the time of each sale.\n`;

    // Platform breakdown
    const platformAgg: Record<string, { units: number; revenue: number }> = {};
    for (const s of sales) {
      if (!platformAgg[s.platform]) platformAgg[s.platform] = { units: 0, revenue: 0 };
      platformAgg[s.platform].units += s.qty;
      platformAgg[s.platform].revenue += s.revenue;
    }
    salesContext += '- By platform:\n';
    for (const [platform, agg] of Object.entries(platformAgg)) {
      salesContext += `    • ${platform}: ${agg.units} units, ${fmtIDR(agg.revenue)}\n`;
    }

    // Best sellers (top 10 by units)
    const bySeller: Record<string, { units: number; revenue: number }> = {};
    for (const s of sales) {
      const label = variantLabel(s.product_variants);
      if (!bySeller[label]) bySeller[label] = { units: 0, revenue: 0 };
      bySeller[label].units += s.qty;
      bySeller[label].revenue += s.revenue;
    }
    const bestSellers = Object.entries(bySeller)
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 10);
    salesContext += '- Best sellers (top 10 by units):\n';
    for (const [label, agg] of bestSellers) {
      salesContext += `    • ${label}: ${agg.units} units, ${fmtIDR(agg.revenue)}\n`;
    }

    // ---------------------------------------------------------------
    // Recent stock movement context
    // ---------------------------------------------------------------
    let activityContext = '\nRECENT STOCK MOVEMENTS (last 20):\n';
    for (const m of movements) {
      const date = new Date(m.created_at).toLocaleDateString('en-GB');
      const action = m.type === 'in' ? 'IN ' : 'OUT';
      const platform = m.platform ? ` via ${m.platform}` : '';
      const note = m.note ? ` — ${m.note}` : '';
      activityContext += `- ${date}: ${action} ${m.qty} pcs ${variantLabel(m.product_variants)}${platform}${note}\n`;
    }

    const systemPrompt = `You are the inventory and sales assistant for Avenue of Hers, a small Indonesian fashion retail business selling clothing on Shopee, TikTok, Instagram, and other channels. Products are tracked as variants (size / color combinations, each with its own SKU). You have complete, current data below.

${inventoryContext}
${salesContext}
${activityContext}

YOUR CAPABILITIES:
- Report exact stock levels for any product, size, color, or SKU
- Flag out-of-stock and low-stock variants and recommend what to restock first
- Report revenue, COGS, gross profit, and margin (all amounts in Indonesian Rupiah)
- Compare platform performance (Shopee vs TikTok vs Instagram vs Other)
- Identify best sellers and slow movers
- Estimate when a variant will run out based on its ${SALES_WINDOW_DAYS}-day sales rate
- Report recent stock movement history
- Answer in the same language as the user (Indonesian or English)

OUTPUT FORMAT (STRICT — your answer renders in a small plain-text chat bubble):
- Plain conversational text only. NO markdown headers (#), NO bold/italics (** or *), NO tables, NO horizontal rules
- NEVER use LaTeX or math notation: no \\( \\), no $$, no \\frac, no \\times. Write calculations as plain text, e.g. "4 x Rp 499.000 = Rp 1.996.000"
- Simple dash lists ("- item") and short paragraphs are fine
- Keep answers compact; this is a chat window, not a report

GUIDELINES:
- Be precise and use exact numbers from the data; format money as Rupiah (e.g. Rp 150.000)
- If asked what to restock, prioritize variants that are low or out of stock AND selling well
- Days-of-stock estimates are based on the ${SALES_WINDOW_DAYS}-day average sales rate — call them estimates
- Proactively mention urgent issues (fast sellers about to run out) when relevant
- Be concise but thorough
- If a product, size, or color is not in the data, say so clearly rather than guessing`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error('Anthropic API error');
    }

    const data = await response.json();
    const assistantMessage = data.content?.[0]?.text || 'Sorry, I could not generate a response.';

    return new Response(JSON.stringify({ response: assistantMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in inventory-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
