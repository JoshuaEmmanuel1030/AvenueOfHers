import React, { useState, useEffect } from 'react';
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
import { Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { ProductVariant } from '@/types';
import { cn } from '@/lib/utils';

interface StockAdjustModalProps {
  variant: ProductVariant | null;
  productName: string;
  initialType?: 'in' | 'out';
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustModal({ variant, productName, initialType = 'in', onClose, onSuccess }: StockAdjustModalProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<'in' | 'out'>(initialType);

  useEffect(() => {
    if (variant) setType(initialType);
  }, [variant, initialType]);
  const [qty, setQty] = useState('');
  const [platform, setPlatform] = useState<string>('Manual');
  const [note, setNote] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variant) return;

    const qtyNum = parseInt(qty);
    if (!qtyNum || qtyNum <= 0) {
      toast.error('Enter a valid quantity.');
      return;
    }
    if (type === 'out' && qtyNum > variant.stock_qty) {
      toast.error(`Only ${variant.stock_qty} units in stock.`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc('adjust_stock', {
        p_variant_id: variant.id,
        p_type: type,
        p_qty: qtyNum,
        p_platform: platform,
        p_note: note || null,
      });

      if (error) throw error;

      toast.success(`Stock ${type === 'in' ? 'added' : 'removed'} successfully.`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error('Failed to adjust stock: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setType('in');
    setQty('');
    setPlatform('Manual');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={!!variant} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Adjust Stock</DialogTitle>
          <DialogDescription className="text-slate-500">
            {variant ? `${productName} · ${variant.size} / ${variant.color} · Current stock: ${variant.stock_qty}` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* In / Out toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('in')}
              className={cn(
                'flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-semibold transition-colors',
                type === 'in'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-border text-slate-400 hover:bg-slate-50'
              )}
            >
              <ArrowUpCircle size={16} /> Stock In
            </button>
            <button
              type="button"
              onClick={() => setType('out')}
              className={cn(
                'flex items-center justify-center gap-2 h-11 rounded-lg border text-sm font-semibold transition-colors',
                type === 'out'
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-border text-slate-400 hover:bg-slate-50'
              )}
            >
              <ArrowDownCircle size={16} /> Stock Out
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity</Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={qty}
                onChange={e => setQty(e.target.value.replace(/\D/g, ''))}
                required
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Platform / Source</Label>
              <Select value={platform} onValueChange={setPlatform}>
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
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Note <span className="text-slate-300 normal-case font-normal">(optional)</span></Label>
            <Input
              placeholder="e.g. Restock from supplier, damaged goods..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="h-10 border-border"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="h-10 border-border">Cancel</Button>
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                'h-10 px-6 font-medium shadow-sm text-white',
                type === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : type === 'in' ? 'Add Stock' : 'Remove Stock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
