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
import { Product } from '@/types';

interface LogSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogSaleModal({ isOpen, onClose, onSuccess }: LogSaleModalProps) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    product_id: '',
    qty: 1,
    platform: 'Shopee',
    sale_date: new Date().toISOString().split('T')[0],
    revenue: 0
  });

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Failed to fetch products for modal:', error);
    }
  };

  const selectedProduct = products.find(p => p.id === formData.product_id);

  useEffect(() => {
    if (selectedProduct) {
      setFormData(prev => ({
        ...prev,
        revenue: selectedProduct.sell_price * prev.qty
      }));
    }
  }, [formData.product_id, formData.qty, selectedProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_id) {
      toast.error('Please select a product');
      return;
    }

    setLoading(true);
    try {
      // 1. Log the sale
      const { error: saleError } = await supabase
        .from('sales')
        .insert([formData]);

      if (saleError) throw saleError;

      // 2. Decrement product stock
      if (selectedProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_qty: selectedProduct.stock_qty - formData.qty })
          .eq('id', formData.product_id);

        if (updateError) throw updateError;
      }

      toast.success('Sale logged successfully!');
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        product_id: '',
        qty: 1,
        platform: 'Shopee',
        sale_date: new Date().toISOString().split('T')[0],
        revenue: 0
      });
    } catch (error: any) {
      toast.error('Failed to log sale: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Log New Sale</DialogTitle>
          <DialogDescription className="text-slate-500">
            Record a sale transaction. Stock will be updated automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="product" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product</Label>
              <Select 
                value={formData.product_id} 
                onValueChange={(val) => setFormData(p => ({ ...p, product_id: val }))}
              >
                <SelectTrigger className="h-10 border-border">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.stock_qty <= 0}>
                      <div className="flex flex-col items-start py-0.5">
                        <span className="font-medium text-sm">{p.name} - {p.variant}</span>
                        <span className="text-[10px] text-slate-400">Stock: {p.stock_qty} | {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p.sell_price)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="qty" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quantity Sold</Label>
                <Input 
                  id="qty" 
                  type="number" 
                  min={1} 
                  max={selectedProduct?.stock_qty || 100}
                  value={formData.qty} 
                  onChange={(e) => setFormData(p => ({ ...p, qty: parseInt(e.target.value) || 1 }))}
                  required 
                  className="h-10 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Platform</Label>
                <Select 
                  value={formData.platform} 
                  onValueChange={(val) => setFormData(p => ({ ...p, platform: val }))}
                >
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

            <div className="space-y-1.5 text-stone-600 font-medium">
              <Label htmlFor="sale_date" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sale Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input 
                  id="sale_date" 
                  type="date" 
                  value={formData.sale_date} 
                  onChange={(e) => setFormData(p => ({ ...p, sale_date: e.target.value }))}
                  required 
                  className="h-10 pl-10 border-border"
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="bg-slate-50 p-4 rounded-lg border border-border">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Revenue</p>
                <p className="text-xl font-bold text-slate-800 tracking-tight">
                  {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(formData.revenue)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading || !formData.product_id} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
