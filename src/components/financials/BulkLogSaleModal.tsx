import React, { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ChevronsUpDown, Check, Calendar, AlertTriangle } from 'lucide-react';
import { ProductWithVariants, ProductVariant } from '@/types';
import { cn } from '@/lib/utils';
import { parseSupabaseError } from '@/lib/errors';

type FlatVariant = ProductVariant & { productName: string };

interface BulkSaleRow {
  id: string;
  variantId: string;
  qty: string;
  priceOverride: string;
}

const PLATFORMS = ['Shopee', 'TikTok', 'Instagram', 'Other'];

const formatIDR = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const withCommas = (val: string) => {
  const digits = val.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const stripCommas = (val: string) => val.replace(/,/g, '');

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: ProductWithVariants[];
}

function newRow(): BulkSaleRow {
  return { id: crypto.randomUUID(), variantId: '', qty: '', priceOverride: '' };
}

export function BulkLogSaleModal({ open, onClose, onSuccess, products }: Props) {
  const [platform, setPlatform] = useState('Shopee');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<BulkSaleRow[]>([newRow()]);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const allVariants: FlatVariant[] = products.flatMap(p =>
    p.product_variants.map(v => ({ ...v, productName: p.name }))
  );

  const addRow = () => setRows(r => [...r, newRow()]);
  const removeRow = (id: string) => setRows(r => r.filter(row => row.id !== id));
  const updateRow = (id: string, patch: Partial<BulkSaleRow>) =>
    setRows(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

  const resolvedRows = rows.map(row => {
    const variant = allVariants.find(v => v.id === row.variantId);
    const qty = parseInt(row.qty) || 0;
    // Explicit empty check so an intentional 0 override (giveaway) isn't replaced by the list price
    const overridden = parseFloat(stripCommas(row.priceOverride));
    const price = row.priceOverride.trim() !== '' && !isNaN(overridden) ? overridden : (variant?.sell_price ?? 0);
    return { row, variant, qty, price, revenue: price * qty };
  });

  const validRows = resolvedRows.filter(r => r.variant && r.qty > 0);
  const hasOversell = validRows.some(r => r.qty > r.variant!.stock_qty);
  const totalUnits = validRows.reduce((s, r) => s + r.qty, 0);
  const totalRevenue = validRows.reduce((s, r) => s + r.revenue, 0);

  const summaryGroups: Record<string, typeof validRows> = validRows.reduce<Record<string, typeof validRows>>(
    (acc, r) => {
      const name = r.variant!.productName;
      if (!acc[name]) acc[name] = [];
      acc[name].push(r);
      return acc;
    }, {}
  );

  const handleSubmit = async () => {
    if (submittingRef.current || loading) return;
    if (validRows.length === 0) { toast.error('Add at least one variant with a quantity.'); return; }
    submittingRef.current = true;
    setLoading(true);
    try {
      // Sort by variant_id so concurrent batches lock rows in the same order (deadlock avoidance).
      const { error } = await supabase.rpc('log_sale_batch', {
        p_sales: validRows
          .slice()
          .sort((a, b) => a.row.variantId.localeCompare(b.row.variantId))
          .map(({ row, variant, qty, price }) => ({
          variant_id: row.variantId,
          qty,
          platform,
          sale_date: saleDate,
          revenue: price * qty,
          cost_price_at_sale: variant!.cost_price,
        })),
      });
      if (error) throw error;
      toast.success(`${validRows.length} sale${validRows.length !== 1 ? 's' : ''} logged · ${totalUnits} units · ${formatIDR(totalRevenue)}`);
      setRows([newRow()]);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err?.message?.includes('Insufficient stock')) {
        toast.error('No sales were saved — one or more rows exceed available stock. Refresh and try again.');
      } else {
        toast.error(`No sales were saved — the batch failed: ${parseSupabaseError(err)}`);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRows([newRow()]);
    setPlatform('Shopee');
    setSaleDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] max-w-5xl sm:max-w-5xl h-[80vh] max-h-[720px] rounded-xl border-border shadow-xl p-0 gap-0 overflow-hidden flex flex-col">

        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-800">Bulk Log Sales</DialogTitle>
          <DialogDescription className="text-slate-500">
            Record multiple sales at once — stock updates automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">

          {/* Left: Form */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">

            {/* Shared controls */}
            <div className="px-6 py-3 border-b border-border bg-slate-50 flex flex-wrap gap-3 items-end flex-shrink-0">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="h-9 border-border text-sm w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sale Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                  <Input
                    type="date"
                    value={saleDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setSaleDate(e.target.value)}
                    className="h-9 pl-8 border-border text-sm w-40"
                  />
                </div>
              </div>
            </div>

            {/* Column headers */}
            <div className="px-6 pt-4 pb-1 flex-shrink-0">
              <div className="grid grid-cols-[minmax(0,2fr)_64px_120px_32px] gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Variant</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Price / unit (IDR)</span>
                <span />
              </div>
            </div>

            {/* Scrollable rows */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-2">
              {rows.map(row => {
                const resolved = resolvedRows.find(r => r.row.id === row.id);
                return (
                  <React.Fragment key={row.id}>
                    <SaleRowItem
                      row={row}
                      allVariants={allVariants}
                      usedVariantIds={rows.filter(r => r.id !== row.id).map(r => r.variantId)}
                      onChange={(patch) => updateRow(row.id, patch)}
                      onRemove={() => removeRow(row.id)}
                      canRemove={rows.length > 1}
                      listPrice={resolved?.variant?.sell_price}
                    />
                  </React.Fragment>
                );
              })}
              <button
                onClick={addRow}
                className="w-full h-9 flex items-center gap-2 px-3 rounded-md border border-dashed border-border text-slate-400 hover:text-primary hover:border-primary transition-colors text-[11px] font-bold"
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            <div className="px-6 py-3 border-t border-border bg-slate-50 flex justify-end flex-shrink-0">
              <Button type="button" variant="outline" onClick={handleClose} className="h-8 text-sm border-border">
                Cancel
              </Button>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="w-64 border-l border-border bg-slate-50 flex flex-col flex-shrink-0 min-h-0">
            <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sale Summary</p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {platform}
                </span>
                <p className="text-[10px] text-slate-400">{saleDate}</p>
              </div>

              <div className="border-t border-border pt-3">
                {validRows.length === 0 ? (
                  <p className="text-[11px] text-slate-300 italic">No items added yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(summaryGroups).map(([productName, items]) => (
                      <div key={productName}>
                        <p className="text-[11px] font-bold text-slate-700 mb-1">{productName}</p>
                        <div className="space-y-0.5">
                          {items.map(({ row, variant, qty, revenue }) => (
                            <div key={row.id} className="flex justify-between items-baseline gap-2">
                              <span className="text-[11px] text-slate-500 truncate">
                                {variant!.size} / {variant!.color} ×{qty}
                              </span>
                              <span className="text-[11px] font-bold text-primary flex-shrink-0">
                                {formatIDR(revenue)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-4 border-t border-border space-y-3 flex-shrink-0">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">{validRows.length} variant{validRows.length !== 1 ? 's' : ''} · {totalUnits} units</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Revenue</span>
                  <span className="text-lg font-bold text-primary">{formatIDR(totalRevenue)}</span>
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading || validRows.length === 0 || hasOversell}
                className="w-full h-10 font-semibold text-white bg-primary hover:bg-primary/90 shadow-sm"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : `Submit (${validRows.length})`
                }
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SaleRowItemProps {
  readonly row: BulkSaleRow;
  readonly allVariants: FlatVariant[];
  readonly usedVariantIds: string[];
  readonly onChange: (patch: Partial<BulkSaleRow>) => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
  readonly listPrice?: number;
}

function SaleRowItem({ row, allVariants, usedVariantIds, onChange, onRemove, canRemove, listPrice }: SaleRowItemProps) {
  const [open, setOpen] = useState(false);
  const selected = allVariants.find(v => v.id === row.variantId);
  const qtyNum = parseInt(row.qty) || 0;
  const isOutOfStock = !!selected && selected.stock_qty === 0;
  const isOversell = !!selected && selected.stock_qty > 0 && qtyNum > selected.stock_qty;

  const handleVariantSelect = (v: FlatVariant) => {
    onChange({ variantId: v.id, priceOverride: String(v.sell_price) });
    setOpen(false);
  };

  return (
    <>
    <div className="grid grid-cols-[minmax(0,2fr)_64px_120px_32px] gap-2 items-center">
      {/* Variant combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            'h-9 w-full flex items-center justify-between px-3 rounded-md border border-border bg-white text-sm hover:border-slate-300 transition-colors text-left',
            !selected && 'text-slate-400'
          )}
        >
          <span className="truncate">
            {selected
              ? `${selected.productName} · ${selected.size} / ${selected.color}`
              : 'Search variant...'}
          </span>
          <ChevronsUpDown size={13} className="text-slate-400 flex-shrink-0 ml-1" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Name, SKU, size, color..." className="h-9 text-sm" />
            <CommandList>
              <CommandEmpty>No variants found.</CommandEmpty>
              <CommandGroup>
                {allVariants.map(v => {
                  const isUsed = usedVariantIds.includes(v.id);
                  return (
                    <CommandItem
                      key={v.id}
                      value={`${v.productName} ${v.size} ${v.color} ${v.sku}`}
                      disabled={isUsed}
                      onSelect={() => !isUsed && handleVariantSelect(v)}
                      className={cn('text-sm', isUsed && 'opacity-40 cursor-not-allowed', v.stock_qty === 0 && 'opacity-60')}
                    >
                      <Check
                        size={13}
                        className={cn('mr-2 flex-shrink-0', row.variantId === v.id ? 'opacity-100' : 'opacity-0')}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{v.productName} · {v.size} / {v.color}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {v.sku} · {v.stock_qty === 0 ? 'out of stock' : `${v.stock_qty} left`}
                        </p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Qty */}
      <Input
        inputMode="numeric"
        placeholder="0"
        value={row.qty}
        onChange={e => onChange({ qty: e.target.value.replace(/\D/g, '') })}
        className="h-9 border-border text-sm text-center font-mono"
      />

      {/* Price override */}
      <div className="relative">
        <Input
          inputMode="numeric"
          placeholder={listPrice ? String(listPrice) : '—'}
          value={withCommas(row.priceOverride)}
          onChange={e => onChange({ priceOverride: stripCommas(e.target.value) })}
          disabled={!selected}
          className={cn(
            'h-9 border-border text-sm font-mono',
            listPrice && row.priceOverride && parseFloat(stripCommas(row.priceOverride)) !== listPrice
              && 'border-amber-300 bg-amber-50'
          )}
        />
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className={cn(
          'h-8 w-8 flex items-center justify-center rounded-md transition-colors',
          canRemove ? 'text-slate-300 hover:bg-rose-50 hover:text-rose-400' : 'text-slate-200 cursor-not-allowed'
        )}
      >
        <Trash2 size={13} />
      </button>
    </div>
    {(isOutOfStock || isOversell) && (
      <div className={cn(
        'flex items-center gap-1.5 -mt-1 mb-0.5 px-1 text-[10px] font-medium',
        isOutOfStock ? 'text-rose-500' : 'text-amber-600'
      )}>
        <AlertTriangle size={10} className="shrink-0" />
        {isOutOfStock ? 'Out of stock' : `Only ${selected!.stock_qty} left`}
      </div>
    )}
    </>
  );
}
