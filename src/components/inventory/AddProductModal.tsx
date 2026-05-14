import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

interface VariantRow {
  size: string;
  color: string;
  sku: string;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  reorder_threshold: number;
}

const emptyVariant = (): VariantRow => ({
  size: '',
  color: '',
  sku: '',
  cost_price: 0,
  sell_price: 0,
  stock_qty: 0,
  reorder_threshold: 5,
});

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);

  const updateVariant = (index: number, field: keyof VariantRow, value: string | number) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const addVariant = () => setVariants(prev => [...prev, emptyVariant()]);

  const removeVariant = (index: number) => {
    if (variants.length === 1) return;
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (variants.some(v => !v.size || !v.color || !v.sku)) {
      toast.error('Each variant must have a size, color, and SKU.');
      return;
    }

    setLoading(true);
    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([{ name: productName, category: category || null }])
        .select()
        .single();

      if (productError) throw productError;

      const { error: variantError } = await supabase
        .from('product_variants')
        .insert(variants.map(v => ({ ...v, product_id: product.id })));

      if (variantError) throw variantError;

      toast.success('Product added successfully!');
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error('Failed to add product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProductName('');
    setCategory('');
    setVariants([emptyVariant()]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] rounded-xl border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Add New Product</DialogTitle>
          <DialogDescription className="text-slate-500">
            Add the product style and its size/color variants below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Product Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product Name</Label>
              <Input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g. Floral Midi Dress"
                required
                className="h-10 border-border"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category <span className="text-slate-300 normal-case font-normal">(optional)</span></Label>
              <Input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Dress, Top, Outer"
                className="h-10 border-border"
              />
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Variants</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant} className="h-7 gap-1 text-xs border-border">
                <Plus size={12} /> Add Variant
              </Button>
            </div>

            <div className="space-y-3">
              {variants.map((v, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Variant {i + 1}</span>
                    {variants.length > 1 && (
                      <button type="button" onClick={() => removeVariant(i)} className="text-slate-400 hover:text-rose-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Size</Label>
                      <Input value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)} placeholder="S / M / L" required className="h-9 border-border bg-white text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Color</Label>
                      <Input value={v.color} onChange={e => updateVariant(i, 'color', e.target.value)} placeholder="Black" required className="h-9 border-border bg-white text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKU</Label>
                      <Input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} placeholder="AH-001" required className="h-9 border-border bg-white text-sm font-mono" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cost (IDR)</Label>
                      <Input type="number" value={v.cost_price} onChange={e => updateVariant(i, 'cost_price', parseFloat(e.target.value) || 0)} required className="h-9 border-border bg-white text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sell Price (IDR)</Label>
                      <Input type="number" value={v.sell_price} onChange={e => updateVariant(i, 'sell_price', parseFloat(e.target.value) || 0)} required className="h-9 border-border bg-white text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Initial Stock</Label>
                      <Input type="number" value={v.stock_qty} onChange={e => updateVariant(i, 'stock_qty', parseInt(e.target.value) || 0)} required className="h-9 border-border bg-white text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reorder At</Label>
                      <Input type="number" value={v.reorder_threshold} onChange={e => updateVariant(i, 'reorder_threshold', parseInt(e.target.value) || 5)} required className="h-9 border-border bg-white text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
