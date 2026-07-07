import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { parseSupabaseError } from '@/lib/errors';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { Product } from '@/types';

const withCommas = (val: string) => {
  const digits = val.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const stripCommas = (val: string) => val.replace(/,/g, '');

const generateSku = (productName: string, color: string, size: string, index: number): string => {
  const p = productName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const n = String(index + 1).padStart(3, '0');
  const c = color.replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const s = size.toUpperCase();
  if (!p && !c && !s) return '';
  return [p, n, c, s].filter(Boolean).join('-');
};

interface VariantRow {
  size: string;
  color: string;
  sku: string;
  cost_price: string;
  sell_price: string;
  stock_qty: string;
  reorder_threshold: string;
}

const emptyVariant = (): VariantRow => ({
  size: '', color: '', sku: '', cost_price: '',
  sell_price: '', stock_qty: '', reorder_threshold: '5',
});

interface AddVariantModalProps {
  product: Product | null;
  existingVariantCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVariantModal({ product, existingVariantCount, onClose, onSuccess }: AddVariantModalProps) {
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);

  const updateVariant = (index: number, field: keyof VariantRow, value: string) => {
    setVariants(prev => prev.map((v, i) => {
      if (i !== index) return v;
      const updated = { ...v, [field]: value };
      if ((field === 'size' || field === 'color') && !v.sku && product) {
        const newSize = field === 'size' ? value : v.size;
        const newColor = field === 'color' ? value : v.color;
        updated.sku = generateSku(product.name, newColor, newSize, existingVariantCount + index);
      }
      return updated;
    }));
  };

  const regenerateSku = (index: number) => {
    if (!product) return;
    const v = variants[index];
    const sku = generateSku(product.name, v.color, v.size, existingVariantCount + index);
    setVariants(prev => prev.map((row, i) => i === index ? { ...row, sku } : row));
  };

  const addRow = () => setVariants(prev => [...prev, emptyVariant()]);
  const removeRow = (index: number) => {
    if (variants.length === 1) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !product) return;
    const trimmed = variants.map(v => ({
      ...v,
      size: v.size.trim(),
      color: v.color.trim(),
      sku: v.sku.trim(),
    }));
    if (trimmed.some(v => !v.size || !v.color || !v.sku)) {
      toast.error('Each variant must have a size, color, and SKU.');
      return;
    }

    setLoading(true);
    try {
      // Insert with stock_qty: 0 — initial stock is applied via adjust_stock
      // below so the counter and the stock_movements ledger agree.
      const { data: inserted, error } = await supabase
        .from('product_variants')
        .insert(trimmed.map(v => ({
          product_id: product.id,
          size: v.size,
          color: v.color,
          sku: v.sku,
          cost_price: parseFloat(stripCommas(v.cost_price)) || 0,
          sell_price: parseFloat(stripCommas(v.sell_price)) || 0,
          stock_qty: 0,
          reorder_threshold: parseInt(v.reorder_threshold) || 5,
        })))
        .select('id, sku');

      if (error) throw error;

      const unloggedSkus: string[] = [];
      for (const v of trimmed) {
        const initialQty = parseInt(v.stock_qty) || 0;
        if (initialQty <= 0) continue;
        const insertedRow = inserted?.find(row => row.sku === v.sku);
        if (!insertedRow) {
          unloggedSkus.push(v.sku);
          continue;
        }
        const { error: stockError } = await supabase.rpc('adjust_stock', {
          p_variant_id: insertedRow.id,
          p_type: 'in',
          p_qty: initialQty,
          p_platform: 'Manual',
          p_note: 'Initial stock',
        });
        if (stockError) unloggedSkus.push(v.sku);
      }

      if (unloggedSkus.length > 0) {
        toast.error(
          `Variant${unloggedSkus.length > 1 ? 's were' : ' was'} created, but initial stock could not be logged for ${unloggedSkus.join(', ')}. Use Stock In to set the quantity.`
        );
      } else {
        toast.success(`${trimmed.length} variant${trimmed.length > 1 ? 's' : ''} added to ${product.name}.`);
      }
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(parseSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVariants([emptyVariant()]);
    onClose();
  };

  return (
    <Dialog open={!!product} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] rounded-xl border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Add Variants to {product?.name}</DialogTitle>
          <DialogDescription className="text-slate-500">
            Add new size or color variants to this product.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {product && (product.available_sizes?.length === 0 || product.available_colors?.length === 0) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This product has no {product.available_sizes?.length === 0 && 'sizes'}
                {product.available_sizes?.length === 0 && product.available_colors?.length === 0 && ' or '}
                {product.available_colors?.length === 0 && 'colors'} defined in the Catalogue. Set them up there for cleaner dropdowns.
              </span>
            </div>
          )}
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">New Variant {i + 1}</span>
                  {variants.length > 1 && (
                    <button type="button" onClick={() => removeRow(i)} className="text-slate-400 hover:text-rose-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</Label>
                    {product?.available_sizes?.length ? (
                      <Select value={v.size} onValueChange={val => updateVariant(i, 'size', val)} required>
                        <SelectTrigger className="h-9 border-border bg-white text-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {product.available_sizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)} placeholder="S / M / L" required className="h-9 border-border bg-white text-sm" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</Label>
                    {product?.available_colors?.length ? (
                      <Select value={v.color} onValueChange={val => updateVariant(i, 'color', val)} required>
                        <SelectTrigger className="h-9 border-border bg-white text-sm">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {product.available_colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={v.color} onChange={e => updateVariant(i, 'color', e.target.value)} placeholder="Mint" required className="h-9 border-border bg-white text-sm" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</Label>
                      <button type="button" onClick={() => regenerateSku(i)} title="Regenerate SKU" className="text-slate-400 hover:text-primary transition-colors">
                        <RefreshCw size={11} />
                      </button>
                    </div>
                    <Input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} placeholder="Auto-generated" required className="h-9 border-border bg-white text-sm font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost (IDR)</Label>
                    <Input inputMode="numeric" placeholder="0" value={withCommas(v.cost_price)} onChange={e => updateVariant(i, 'cost_price', stripCommas(e.target.value))} required className="h-9 border-border bg-white text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sell Price (IDR)</Label>
                    <Input inputMode="numeric" placeholder="0" value={withCommas(v.sell_price)} onChange={e => updateVariant(i, 'sell_price', stripCommas(e.target.value))} required className="h-9 border-border bg-white text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Initial Stock</Label>
                    <Input inputMode="numeric" placeholder="0" value={v.stock_qty} onChange={e => updateVariant(i, 'stock_qty', e.target.value)} required className="h-9 border-border bg-white text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reorder At</Label>
                    <Input inputMode="numeric" placeholder="5" value={v.reorder_threshold} onChange={e => updateVariant(i, 'reorder_threshold', e.target.value)} required className="h-9 border-border bg-white text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 gap-1 text-xs border-border">
            <Plus size={12} /> Add Another Variant
          </Button>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Variants'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
