import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { ProductWithVariants } from '@/types';

interface QuickStockInModalProps {
  open: boolean;
  products: ProductWithVariants[];
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickStockInModal({ open, products, onClose, onSuccess }: QuickStockInModalProps) {
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [qty, setQty] = useState('');
  const [platform, setPlatform] = useState('Manual');
  const [note, setNote] = useState('');

  const selectedProduct = useMemo(
    () => products.find(p => p.id === productId) ?? null,
    [products, productId]
  );

  // Sizes: prefer Catalogue definition, fallback to sizes that exist in variants
  const availableSizes = useMemo(() => {
    if (!selectedProduct) return [];
    if (selectedProduct.available_sizes?.length) return selectedProduct.available_sizes;
    return [...new Set(selectedProduct.product_variants.map(v => v.size))].sort();
  }, [selectedProduct]);

  // Colors: filtered by selected size if possible, else full product color list
  const availableColors = useMemo(() => {
    if (!selectedProduct) return [];
    const variantsForSize = size
      ? selectedProduct.product_variants.filter(v => v.size === size)
      : selectedProduct.product_variants;
    if (variantsForSize.length > 0) {
      return [...new Set(variantsForSize.map(v => v.color))].sort();
    }
    if (selectedProduct.available_colors?.length) return selectedProduct.available_colors;
    return [...new Set(selectedProduct.product_variants.map(v => v.color))].sort();
  }, [selectedProduct, size]);

  const matchedVariant = useMemo(() => {
    if (!selectedProduct || !size || !color) return null;
    return selectedProduct.product_variants.find(v => v.size === size && v.color === color) ?? null;
  }, [selectedProduct, size, color]);

  const handleProductChange = (val: string) => {
    setProductId(val);
    setSize('');
    setColor('');
  };

  const handleSizeChange = (val: string) => {
    setSize(val);
    setColor('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedVariant) return;

    const qtyNum = parseInt(qty);
    if (!qtyNum || qtyNum <= 0) {
      toast.error('Enter a valid quantity.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('adjust_stock', {
        p_variant_id: matchedVariant.id,
        p_type: 'in',
        p_qty: qtyNum,
        p_platform: platform,
        p_note: note || null,
      });
      if (error) throw error;

      toast.success(`Stock added: ${selectedProduct!.name} · ${size} / ${color}`);
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error('Failed to add stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProductId('');
    setSize('');
    setColor('');
    setQty('');
    setPlatform('Manual');
    setNote('');
    onClose();
  };

  const variantMissing = productId && size && color && !matchedVariant;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Stock In</DialogTitle>
          <DialogDescription className="text-slate-500">
            Select a style, then its size and color to restock.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Style */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Style</Label>
            <Select value={productId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-10 border-border">
                <SelectValue placeholder="Select product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Size</Label>
              <Select value={size} onValueChange={handleSizeChange} disabled={!productId}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSizes.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Color</Label>
              <Select value={color} onValueChange={setColor} disabled={!size}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {availableColors.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variant not found warning */}
          {variantMissing && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                No variant exists for {size} / {color}. Use <strong>Add Variant</strong> on the product row to create it first.
              </span>
            </div>
          )}

          {/* Current stock indicator */}
          {matchedVariant && (
            <p className="text-xs text-slate-400">
              Current stock: <span className="font-semibold text-slate-600">{matchedVariant.stock_qty} units</span>
            </p>
          )}

          {/* Qty + Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity</Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={qty}
                onChange={e => setQty(e.target.value.replace(/\D/g, ''))}
                disabled={!matchedVariant}
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Source</Label>
              <Select value={platform} onValueChange={setPlatform} disabled={!matchedVariant}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Shopee">Shopee</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Note <span className="text-slate-300 normal-case font-normal">(optional)</span>
            </Label>
            <Input
              placeholder="e.g. Restock from supplier…"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={!matchedVariant}
              className="h-10 border-border"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="h-10 border-border">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !matchedVariant || !qty}
              className="h-10 px-6 font-medium shadow-sm text-white bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
