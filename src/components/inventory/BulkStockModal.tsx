import React, { useState, useCallback } from 'react';
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
import { format } from 'date-fns';

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
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [platform, setPlatform] = useState('Shopee');
  const [rows, setRows] = useState<BulkRow[]>([newRow()]);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async () => {
    if (loading) return;
    if (validRows.length === 0) { toast.error('Add at least one variant with a quantity.'); return; }
    setLoading(true);
    try {
      await Promise.all(
        validRows.map(row =>
          supabase.rpc('adjust_stock', {
            p_variant_id: row.variantId,
            p_type: type,
            p_qty: parseInt(row.qty),
            p_platform: platform,
            p_note: row.note || null,
          })
        )
      );
      toast.success(`${validRows.length} movement${validRows.length !== 1 ? 's' : ''} recorded · ${totalUnits} units ${type === 'in' ? 'added' : 'removed'}`);
      setRows([newRow()]);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-xl border-border shadow-xl p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Left: Form */}
          <div className="flex-1 flex flex-col min-w-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
              <DialogTitle className="text-xl font-bold text-slate-800">Bulk Stock Movement</DialogTitle>
              <DialogDescription className="text-slate-500">
                Add multiple variants at once — one submit records everything.
              </DialogDescription>
            </DialogHeader>

            {/* Header controls */}
            <div className="px-6 py-4 border-b border-border bg-slate-50 flex flex-wrap gap-3 items-end">
              {/* Type toggle */}
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

              {/* Date */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="h-9 border-border text-sm w-40"
                />
              </div>

              {/* Platform */}
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
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 max-h-[380px]">
              {/* Column labels */}
              <div className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Variant</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Note</span>
                <span />
              </div>

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

              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors mt-1 px-1"
              >
                <Plus size={13} /> Add Row
              </button>
            </div>

            <div className="px-6 py-4 border-t border-border bg-slate-50">
              <Button type="button" variant="outline" onClick={onClose} className="h-9 border-border text-sm">
                Cancel
              </Button>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="w-64 border-l border-border bg-slate-50 flex flex-col flex-shrink-0">
            <div className="px-4 pt-5 pb-3 border-b border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Movement Summary</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {/* Meta */}
              <div className="space-y-1">
                <div className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full',
                  type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                )}>
                  {type === 'in' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                  {type === 'in' ? 'Stock In' : 'Stock Out'}
                </div>
                <p className="text-[10px] text-slate-400">{platform} · {format(new Date(date), 'MMM d, yyyy')}</p>
              </div>

              {validRows.length === 0 ? (
                <p className="text-[11px] text-slate-300 italic">No items added yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(summaryGroups).map(([productName, items]) => (
                    <div key={productName}>
                      <p className="text-[11px] font-bold text-slate-700 mb-1">{productName}</p>
                      <div className="space-y-0.5">
                        {items.map(({ variant, qty }, i) => (
                          <div key={i} className="flex justify-between items-baseline">
                            <span className="text-[11px] text-slate-500 truncate mr-2">
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

            {/* Footer total + submit */}
            <div className="px-4 py-4 border-t border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400">{validRows.length} variant{validRows.length !== 1 ? 's' : ''}</span>
                <span className={cn(
                  'text-base font-bold',
                  type === 'in' ? 'text-emerald-600' : 'text-rose-500'
                )}>
                  {type === 'in' ? '+' : '−'}{totalUnits} units
                </span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={loading || validRows.length === 0}
                className={cn(
                  'w-full h-10 font-semibold text-white shadow-sm',
                  type === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
                )}
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : `Submit ${validRows.length > 0 ? `(${validRows.length})` : ''}`
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
    <div className="grid grid-cols-[1fr_80px_1fr_32px] gap-2 items-center">
      {/* Variant combobox */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'h-9 w-full flex items-center justify-between px-3 rounded-md border border-border bg-white text-sm hover:border-slate-300 transition-colors',
              !selected && 'text-slate-400'
            )}
          >
            <span className="truncate">
              {selected
                ? `${selected.productName} · ${selected.size} / ${selected.color}`
                : 'Search variant...'}
            </span>
            <ChevronsUpDown size={13} className="text-slate-400 flex-shrink-0 ml-1" />
          </button>
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
          canRemove ? 'hover:bg-rose-50 text-slate-300 hover:text-rose-400' : 'opacity-0 pointer-events-none'
        )}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
