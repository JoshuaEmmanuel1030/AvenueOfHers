import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Calendar } from 'lucide-react';
import { ProductWithVariants, ProductVariant } from '@/types';

interface LogSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

export function LogSaleModal({ isOpen, onClose, onSuccess }: LogSaleModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [platform, setPlatform] = useState<'Shopee' | 'TikTok' | 'Other'>('Shopee');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) fetchProducts();
  }, [isOpen]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .eq('is_archived', false)
      .order('name');
    if (!error) setProducts((data as ProductWithVariants[]) || []);
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const availableVariants = selectedProduct?.product_variants.filter(v => v.stock_qty > 0) ?? [];
  const selectedVariant: ProductVariant | undefined = selectedProduct?.product_variants.find(v => v.id === selectedVariantId);
  const revenue = (selectedVariant?.sell_price ?? 0) * qty;

  const handleProductChange = (val: string) => {
    setSelectedProductId(val);
    setSelectedVariantId('');
    setQty(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      toast.error('Please select a variant.');
      return;
    }

    setLoading(true);
    try {
      const { error: saleError } = await supabase
        .from('sales')
        .insert([{ variant_id: selectedVariantId, qty, platform, sale_date: saleDate, revenue }]);

      if (saleError) throw saleError;

      const { error: stockError } = await supabase
        .from('product_variants')
        .update({ stock_qty: selectedVariant!.stock_qty - qty })
        .eq('id', selectedVariantId);

      if (stockError) throw stockError;

      toast.success('Sale logged successfully!');
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error('Failed to log sale: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedProductId('');
    setSelectedVariantId('');
    setQty(1);
    setPlatform('Shopee');
    setSaleDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Log New Sale</DialogTitle>
          <DialogDescription className="text-slate-500">
            Record a sale transaction. Stock will be updated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Product */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product</Label>
            <Select value={selectedProductId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-10 border-border">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Variant */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Variant</Label>
            <Select value={selectedVariantId} onValueChange={setSelectedVariantId} disabled={!selectedProductId}>
              <SelectTrigger className="h-10 border-border">
                <SelectValue placeholder={selectedProductId ? 'Select size / color' : 'Select a product first'} />
              </SelectTrigger>
              <SelectContent>
                {availableVariants.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    <div className="flex flex-col items-start py-0.5">
                      <span className="font-medium text-sm">{v.size} / {v.color}</span>
                      <span className="text-[10px] text-slate-400 font-mono">SKU: {v.sku} · Stock: {v.stock_qty} · {formatIDR(v.sell_price)}</span>
                    </div>
                  </SelectItem>
                ))}
                {selectedProductId && availableVariants.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-400 text-center">No variants in stock</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Qty */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity</Label>
              <Input
                type="number"
                min={1}
                max={selectedVariant?.stock_qty ?? 100}
                value={qty}
                onChange={e => setQty(parseInt(e.target.value) || 1)}
                required
                className="h-10 border-border"
              />
            </div>
            {/* Platform */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Platform</Label>
              <Select value={platform} onValueChange={val => setPlatform(val as typeof platform)}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Shopee">Shopee</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sale Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                type="date"
                value={saleDate}
                onChange={e => setSaleDate(e.target.value)}
                required
                className="h-10 pl-10 border-border"
              />
            </div>
          </div>

          {/* Revenue preview */}
          <div className="bg-slate-50 p-4 rounded-lg border border-border">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-slate-800 tracking-tight">{formatIDR(revenue)}</p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading || !selectedVariantId} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
