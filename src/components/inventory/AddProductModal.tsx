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
import { Loader2 } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    variant: '',
    stock_qty: 0,
    cost_price: 0,
    sell_price: 0,
    reorder_threshold: 5
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('products')
        .insert([formData]);

      if (error) throw error;

      toast.success('Product added successfully!');
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        name: '',
        sku: '',
        variant: '',
        stock_qty: 0,
        cost_price: 0,
        sell_price: 0,
        reorder_threshold: 5
      });
    } catch (error: any) {
      toast.error('Failed to add product: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Add New Product</DialogTitle>
          <DialogDescription className="text-slate-500">
            Enter the details of the new item in your inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product Name</Label>
              <Input 
                id="name" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="e.g. Silk Blossom Blouse"
                required 
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sku" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SKU</Label>
              <Input 
                id="sku" 
                name="sku" 
                value={formData.sku} 
                onChange={handleChange} 
                placeholder="AH-001"
                required 
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variant" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Variant</Label>
              <Input 
                id="variant" 
                name="variant" 
                value={formData.variant} 
                onChange={handleChange} 
                placeholder="M / Mauve"
                required 
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost_price" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cost (IDR)</Label>
              <Input 
                id="cost_price" 
                name="cost_price" 
                type="number" 
                value={formData.cost_price} 
                onChange={handleChange} 
                required 
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell_price" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sell Price (IDR)</Label>
              <Input 
                id="sell_price" 
                name="sell_price" 
                type="number" 
                value={formData.sell_price} 
                onChange={handleChange} 
                required 
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock_qty" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Initial Stock</Label>
              <Input 
                id="stock_qty" 
                name="stock_qty" 
                type="number" 
                value={formData.stock_qty} 
                onChange={handleChange} 
                required 
                className="h-10 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reorder_threshold" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Threshold</Label>
              <Input 
                id="reorder_threshold" 
                name="reorder_threshold" 
                type="number" 
                value={formData.reorder_threshold} 
                onChange={handleChange} 
                required 
                className="h-10 border-border"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
