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
import { Plus, Trash2, Loader2, ChevronsUpDown, Check, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { ProductWithVariants, ProductVariant } from '@/types';
import { cn } from '@/lib/utils';
import { parseSupabaseError } from '@/lib/errors';

type FlatVariant = ProductVariant & { productName: string };

interface BulkRow {
  id: string;
  variantId: string;
  qty: string;
  note: string;
}

const PLATFORMS = ['Shopee', 'TikTok', 'Instagram', 'Manual'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products: ProductWithVariants[];
  initialType?: 'in' | 'out';
}

export function BulkStockModal({ open, onClose, onSuccess, products, initialType = 'out' }: Props) {
  const [type, setType] = useState<'in' | 'out'>(initialType);
  const [platform, setPlatform] = useState('Shopee');
  const [supplier, setSupplier] = useState('');
  const [rows, setRows] = useState<BulkRow[]>([newRow()]);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const allVariants: FlatVariant[] = products.flatMap(p =>
    p.product_variants.map(v => ({ ...v, productName: p.name }))
  );

  function newRow(): BulkRow {
    return { id: crypto.randomUUID(), variantId: '', qty: '', note: '' };
  }

  const addRow = () => setRows(r => [...r, newRow()]);

  const removeRow = (id: string) => setRows(r => r.filter(row => row.id !== id));

  const updateRow = (id: string, patch: Partial<BulkRow>) =>
    setRows(r => r.map(row => row.id === id ? { ...row, ...patch } : row));

  // Summary: only rows with variant + qty selected
  const validRows = rows.filter(r => r.variantId && parseInt(r.qty) > 0);

  // Group by productName for summary
  type SummaryItem = { variant: FlatVariant; qty: number; note: string };
  const summaryGroups: Record<string, SummaryItem[]> = validRows.reduce<Record<string, SummaryItem[]>>(
    (acc, row) => {
      const v = allVariants.find(v => v.id === row.variantId);
      if (!v) return acc;
      if (!acc[v.productName]) acc[v.productName] = [];
      acc[v.productName].push({ variant: v, qty: parseInt(row.qty), note: row.note });
      return acc;
    }, {}
  );

  const totalUnits = validRows.reduce((s, r) => s + (parseInt(r.qty) || 0), 0);

  // Stock-out rows that exceed available stock would fail the DB CHECK — block them up front.
  const hasOversell = type === 'out' && validRows.some(r => {
    const v = allVariants.find(v => v.id === r.variantId);
    return !!v && parseInt(r.qty) > v.stock_qty;
  });

  const handleSubmit = async () => {
    if (submittingRef.current || loading) return;
    if (validRows.length === 0) { toast.error('Add at least one variant with a quantity.'); return; }
    submittingRef.current = true;
    setLoading(true);
    try {
      // Supplier is free text — it can't go in `platform` (CHECK constraint allows
      // only Shopee/TikTok/Instagram/Manual), so fold it into the note instead.
      const supplierText = type === 'in' ? supplier.trim() : '';
      const platformValue = type === 'in' ? 'Manual' : platform;
      // Sort by variant_id so concurrent batches lock rows in the same order (deadlock avoidance).
      const { error } = await supabase.rpc('adjust_stock_batch', {
        p_adjustments: validRows
          .slice()
          .sort((a, b) => a.variantId.localeCompare(b.variantId))
          .map(row => ({
            variant_id: row.variantId,
            type,
            qty: parseInt(row.qty),
            note: [row.note, supplierText].filter(Boolean).join(' — ') || null,
            platform: platformValue,
          })),
      });
      if (error) throw error;
      toast.success(`${validRows.length} movement${validRows.length !== 1 ? 's' : ''} recorded · ${totalUnits} units ${type === 'in' ? 'added' : 'removed'}`);
      setRows([newRow()]);
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err?.message?.includes('Insufficient stock')) {
        toast.error('No movements were recorded — one or more rows exceed available stock. Refresh and try again.');
      } else {
        toast.error(`No movements were recorded — the batch failed: ${parseSupabaseError(err)}`);
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* Fixed height + flex column so inner panels can scroll independently */}
      <DialogContent className="w-[90vw] max-w-5xl sm:max-w-5xl h-[80vh] max-h-[720px] rounded-xl border-border shadow-xl p-0 gap-0 overflow-hidden flex flex-col">

        {/* Title bar */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-xl font-bold text-slate-800">Bulk Stock Movement</DialogTitle>
          <DialogDescription className="text-slate-500">
            Add multiple variants at once — one submit records everything.
          </DialogDescription>
        </DialogHeader>

        {/* Two-panel body — flex-1 + min-h-0 so it can shrink and scroll */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: Form ── */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">

            {/* Shared controls */}
            <div className="px-6 py-3 border-b border-border bg-slate-50 flex flex-wrap gap-3 items-end flex-shrink-0">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direction</Label>
                <div className="flex rounded-lg border border-border overflow-hidden h-9">
                  <button
                    onClick={() => setType('in')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase transition-colors',
                      type === 'in' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                    )}
                  >
                    <ArrowUpCircle size={13} /> Stock In
                  </button>
                  <div className="w-px bg-border" />
                  <button
                    onClick={() => setType('out')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase transition-colors',
                      type === 'out' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:bg-slate-100'
                    )}
                  >
                    <ArrowDownCircle size={13} /> Stock Out
                  </button>
                </div>
              </div>

              {type === 'in' ? (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Supplier <span className="normal-case font-normal text-slate-300">(optional)</span></Label>
                  <Input
                    placeholder="e.g. PT Maju Jaya"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    className="h-9 border-border text-sm w-44"
                  />
                </div>
              ) : (
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
              )}
            </div>

            {/* Column headers */}
            <div className="px-6 pt-4 pb-1 flex-shrink-0">
              <div className="grid grid-cols-[minmax(0,2fr)_72px_minmax(0,1.5fr)_32px] gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Variant</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Note</span>
                <span />
              </div>
            </div>

            {/* Scrollable rows — flex-1 + min-h-0 is the key */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-2">
              {rows.map(row => (
                <React.Fragment key={row.id}>
                  <BulkRowItem
                    row={row}
                    allVariants={allVariants}
                    usedVariantIds={rows.filter(r => r.id !== row.id).map(r => r.variantId)}
                    onChange={(patch) => updateRow(row.id, patch)}
                    onRemove={() => removeRow(row.id)}
                    canRemove={rows.length > 1}
                  />
                </React.Fragment>
              ))}

              {/* Add row — inline after last row */}
              <button
                onClick={addRow}
                className="w-full h-9 flex items-center gap-2 px-3 rounded-md border border-dashed border-border text-slate-400 hover:text-primary hover:border-primary transition-colors text-[11px] font-bold"
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            {/* Cancel only */}
            <div className="px-6 py-3 border-t border-border bg-slate-50 flex justify-end flex-shrink-0">
              <Button type="button" variant="outline" onClick={onClose} className="h-8 text-sm border-border">
                Cancel
              </Button>
            </div>
          </div>

          {/* ── Right: Summary ── */}
          <div className="w-60 border-l border-border bg-slate-50 flex flex-col flex-shrink-0 min-h-0">

            <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Movement Summary</p>
            </div>

            {/* Meta badge + grouped items — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
              <div className="space-y-0.5">
                <div className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                  type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                )}>
                  {type === 'in' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                  {type === 'in' ? 'Stock In' : 'Stock Out'}
                </div>
                <p className="text-[10px] text-slate-400">
                  {type === 'in' ? (supplier.trim() || 'No supplier') : platform}
                </p>
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
                          {items.map(({ variant, qty }, i) => (
                            <div key={i} className="flex justify-between items-baseline gap-2">
                              <span className="text-[11px] text-slate-500 truncate">
                                {variant.size} / {variant.color}
                              </span>
                              <span className={cn(
                                'text-[11px] font-bold flex-shrink-0',
                                type === 'in' ? 'text-emerald-600' : 'text-rose-500'
                              )}>
                                {type === 'in' ? '+' : '−'}{qty}
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

            {/* Total + submit — always visible at bottom */}
            <div className="px-4 py-4 border-t border-border space-y-3 flex-shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400">
                  {validRows.length} variant{validRows.length !== 1 ? 's' : ''}
                </span>
                <span className={cn(
                  'text-lg font-bold',
                  type === 'in' ? 'text-emerald-600' : 'text-rose-500'
                )}>
                  {type === 'in' ? '+' : '−'}{totalUnits}
                  <span className="text-xs font-medium ml-1 opacity-60">units</span>
                </span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading || validRows.length === 0 || hasOversell}
                className={cn(
                  'w-full h-10 font-semibold text-white shadow-sm',
                  type === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                )}
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

interface BulkRowItemProps {
  readonly row: BulkRow;
  readonly allVariants: FlatVariant[];
  readonly usedVariantIds: string[];
  readonly onChange: (patch: Partial<BulkRow>) => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
}

function BulkRowItem({ row, allVariants, usedVariantIds, onChange, onRemove, canRemove }: BulkRowItemProps) {
  const [open, setOpen] = useState(false);
  const selected = allVariants.find(v => v.id === row.variantId);

  return (
    <div className="grid grid-cols-[minmax(0,2fr)_72px_minmax(0,1.5fr)_32px] gap-2 items-center">
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
                      onSelect={() => {
                        onChange({ variantId: v.id });
                        setOpen(false);
                      }}
                      className={cn('text-sm', isUsed && 'opacity-40 cursor-not-allowed')}
                    >
                      <Check
                        size={13}
                        className={cn('mr-2 flex-shrink-0', row.variantId === v.id ? 'opacity-100' : 'opacity-0')}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{v.productName} · {v.size} / {v.color}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{v.sku} · stock: {String(v.stock_qty)}</p>
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

      {/* Note */}
      <Input
        placeholder="Note (optional)"
        value={row.note}
        onChange={e => onChange({ note: e.target.value })}
        className="h-9 border-border text-sm"
      />

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
  );
}
