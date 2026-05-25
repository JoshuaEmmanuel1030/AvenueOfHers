import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { parseSupabaseError } from '@/lib/errors';
import { toast } from 'sonner';
import { Loader2, X, Plus } from 'lucide-react';
import { Product } from '@/types';
import { cn } from '@/lib/utils';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

interface CatalogueProductModalProps {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CatalogueProductModal({ open, product, onClose, onSuccess }: CatalogueProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [collection, setCollection] = useState('');
  const [description, setDescription] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');

  useEffect(() => {
    if (open) {
      setName(product?.name ?? '');
      setCategory(product?.category ?? '');
      setCollection(product?.collection ?? '');
      setDescription(product?.description ?? '');
      setSizes(product?.available_sizes ?? []);
      setColors(product?.available_colors ?? []);
      setColorInput('');
    }
  }, [open, product]);

  const toggleSize = (s: string) => {
    setSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addColor = () => {
    const c = colorInput.trim();
    if (!c) return;
    if (colors.some(x => x.toLowerCase() === c.toLowerCase())) {
      setColorInput('');
      return;
    }
    setColors(prev => [...prev, c]);
    setColorInput('');
  };

  const removeColor = (c: string) => setColors(prev => prev.filter(x => x !== c));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!name.trim()) {
      toast.error('Product name is required.');
      return;
    }
    if (sizes.length === 0) {
      toast.error('Pick at least one available size.');
      return;
    }
    if (colors.length === 0) {
      toast.error('Add at least one available color.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        collection: collection.trim() || null,
        description: description.trim() || null,
        available_sizes: sizes,
        available_colors: colors,
      };

      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw error;
        toast.success('Product updated.');
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
        toast.success('Product added to catalogue.');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(parseSupabaseError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] rounded-xl border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            {product ? 'Edit Product' : 'New Product'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Define the product and what sizes/colors it comes in. Stock variants are added later in Inventory.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Catan Dress" required className="h-10 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Category <span className="text-slate-300 normal-case font-normal">(optional)</span>
              </Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Dress, Top, Outer" className="h-10 border-border" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Collection <span className="text-slate-300 normal-case font-normal">(optional)</span>
              </Label>
              <Input value={collection} onChange={e => setCollection(e.target.value)} placeholder="Summer 2025" className="h-10 border-border" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Description <span className="text-slate-300 normal-case font-normal">(optional)</span>
              </Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Style notes, fabric, fit..." className="h-10 border-border" />
            </div>
          </div>

          {/* Sizes */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available Sizes</Label>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map(s => {
                const active = sizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-bold uppercase border transition-colors',
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-slate-500 border-border hover:bg-slate-50'
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available Colors</Label>
            <div className="flex gap-2">
              <Input
                value={colorInput}
                onChange={e => setColorInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addColor();
                  }
                }}
                placeholder="e.g. Silver, Olive"
                className="h-10 border-border flex-1"
              />
              <Button type="button" variant="outline" onClick={addColor} className="h-10 border-border gap-1">
                <Plus size={14} /> Add
              </Button>
            </div>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {colors.map(c => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-border"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => removeColor(c)}
                      className="text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : product ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
