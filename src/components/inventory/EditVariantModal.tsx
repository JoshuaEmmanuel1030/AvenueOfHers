import React, { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import { ProductVariant } from '@/types';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const withCommas = (val: string) => {
  const digits = val.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const stripCommas = (val: string) => val.replace(/,/g, '');

interface EditVariantModalProps {
  variant: ProductVariant | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditVariantModal({ variant, onClose, onSuccess }: EditVariantModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    size: '',
    color: '',
    sku: '',
    cost_price: '',
    sell_price: '',
    reorder_threshold: '',
  });

  useEffect(() => {
    if (variant) {
      setForm({
        size: variant.size,
        color: variant.color,
        sku: variant.sku,
        cost_price: String(variant.cost_price),
        sell_price: String(variant.sell_price),
        reorder_threshold: String(variant.reorder_threshold),
      });
    }
  }, [variant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variant) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('product_variants')
        .update({
          size: form.size,
          color: form.color,
          sku: form.sku,
          cost_price: parseFloat(stripCommas(form.cost_price)) || 0,
          sell_price: parseFloat(stripCommas(form.sell_price)) || 0,
          reorder_threshold: form.reorder_threshold.trim() === '' ? 5 : (parseInt(form.reorder_threshold) || 0),
        })
        .eq('id', variant.id);

      if (error) throw error;
      toast.success('Variant updated.');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(parseSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!variant} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Edit Variant</DialogTitle>
          <DialogDescription className="text-slate-500">
            Update the details for this variant. Stock quantity is managed through adjustments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Size</Label>
              <Select value={form.size} onValueChange={val => setForm(p => ({ ...p, size: val }))}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([...SIZES, ...(form.size && !SIZES.includes(form.size) ? [form.size] : [])])].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Color</Label>
              <Input value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} required className="h-10 border-border" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SKU</Label>
              <Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} required className="h-10 border-border font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cost Price (IDR)</Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={withCommas(form.cost_price)}
                onChange={e => setForm(p => ({ ...p, cost_price: stripCommas(e.target.value) }))}
                required
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sell Price (IDR)</Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={withCommas(form.sell_price)}
                onChange={e => setForm(p => ({ ...p, sell_price: stripCommas(e.target.value) }))}
                required
                className="h-10 border-border"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Low Stock Alert Threshold</Label>
              <Input
                inputMode="numeric"
                placeholder="5"
                value={form.reorder_threshold}
                onChange={e => setForm(p => ({ ...p, reorder_threshold: e.target.value }))}
                required
                className="h-10 border-border"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
