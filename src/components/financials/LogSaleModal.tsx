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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Calendar, ChevronsUpDown, Check } from 'lucide-react';
import { ProductWithVariants, ProductVariant } from '@/types';
import { cn } from '@/lib/utils';

const withCommas = (val: string) => {
  const digits = val.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const stripCommas = (val: string) => val.replace(/,/g, '');

interface LogSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

type FlatOption = {
  variantId: string;
  productName: string;
  size: string;
  color: string;
  sku: string;
  stock_qty: number;
  sell_price: number;
  cost_price: number;
  label: string;
};

export function LogSaleModal({ isOpen, onClose, onSuccess }: LogSaleModalProps) {
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [comboOpen, setComboOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [platform, setPlatform] = useState<'Shopee' | 'TikTok' | 'Other'>('Shopee');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [overridePriceStr, setOverridePriceStr] = useState('');

  useEffect(() => {
    if (isOpen) fetchProducts();
  }, [isOpen]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('is_archived', false)
        .order('name');
      if (error) throw error;
      setProducts((data as ProductWithVariants[]) || []);
    } catch {
      toast.error('Failed to load products.');
    } finally {
      setProductsLoading(false);
    }
  };

  const flatOptions: FlatOption[] = products.flatMap(p =>
    p.product_variants.map(v => ({
      variantId: v.id,
      productName: p.name,
      size: v.size,
      color: v.color,
      sku: v.sku,
      stock_qty: v.stock_qty,
      sell_price: v.sell_price,
      cost_price: v.cost_price,
      label: `${p.name} · ${v.size} / ${v.color}`,
    }))
  );

  const selectedOption = flatOptions.find(o => o.variantId === selectedVariantId);

  useEffect(() => {
    if (selectedOption) {
      setOverridePriceStr(String(selectedOption.sell_price));
    } else {
      setOverridePriceStr('');
    }
  }, [selectedVariantId]);

  const overridePrice = parseFloat(stripCommas(overridePriceStr)) || 0;
  const revenue = overridePrice * qty;
  const isPriceOverridden = selectedOption && overridePrice !== selectedOption.sell_price;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId || !selectedOption) {
      toast.error('Please select a variant.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('log_sale', {
        p_variant_id: selectedVariantId,
        p_qty: qty,
        p_platform: platform,
        p_sale_date: saleDate,
        p_revenue: revenue,
        p_cost_price_at_sale: selectedOption.cost_price,
      });

      if (error) throw error;

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
    setSelectedVariantId('');
    setComboOpen(false);
    setQty(1);
    setPlatform('Shopee');
    setSaleDate(new Date().toISOString().split('T')[0]);
    setOverridePriceStr('');
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
          {/* Flat variant combobox */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product / Variant</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  disabled={productsLoading}
                  className="w-full h-10 justify-between border-border font-normal text-sm"
                >
                  {productsLoading
                    ? 'Loading…'
                    : selectedOption
                      ? selectedOption.label
                      : 'Search product or variant…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name, size, color, or SKU…" className="h-9" />
                  <CommandList>
                    <CommandEmpty>No variants found.</CommandEmpty>
                    <CommandGroup>
                      {flatOptions.map(opt => (
                        <CommandItem
                          key={opt.variantId}
                          value={`${opt.productName} ${opt.size} ${opt.color} ${opt.sku}`}
                          onSelect={() => {
                            setSelectedVariantId(opt.variantId);
                            setQty(1);
                            setComboOpen(false);
                          }}
                          className={cn(opt.stock_qty === 0 && 'opacity-50')}
                        >
                          <Check
                            className={cn('mr-2 h-4 w-4 shrink-0', selectedVariantId === opt.variantId ? 'opacity-100' : 'opacity-0')}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{opt.productName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {opt.size} / {opt.color} · {opt.sku}
                              {opt.stock_qty === 0 ? ' · Out of stock' : ` · ${opt.stock_qty} left`}
                            </p>
                          </div>
                          <span className="ml-3 text-xs text-slate-500 shrink-0">{formatIDR(opt.sell_price)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Qty */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity</Label>
              <Input
                type="number"
                min={1}
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
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setSaleDate(e.target.value)}
                required
                className="h-10 pl-10 border-border"
              />
            </div>
          </div>

          {/* Revenue — editable unit price + computed total */}
          <div className="bg-slate-50 p-4 rounded-lg border border-border space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Price per unit (IDR)
                </Label>
                {isPriceOverridden && (
                  <button
                    type="button"
                    onClick={() => setOverridePriceStr(String(selectedOption!.sell_price))}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    Reset to list price
                  </button>
                )}
              </div>
              <Input
                inputMode="numeric"
                value={withCommas(overridePriceStr)}
                onChange={e => setOverridePriceStr(stripCommas(e.target.value))}
                disabled={!selectedOption}
                placeholder="Select a variant first"
                className="h-10 border-border bg-white"
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-slate-800 tracking-tight">{formatIDR(revenue)}</p>
              {isPriceOverridden && (
                <p className="text-[10px] text-amber-500 mt-0.5">
                  Custom price · list price is {formatIDR(selectedOption!.sell_price)}
                </p>
              )}
            </div>
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
