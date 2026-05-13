import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Product } from '@/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  PackageX, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { cn } from '@/lib/utils';

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProducts = async () => {
    if (!supabase) {
      toast.error('Supabase client not initialized. Check your secrets.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error('Inventory Fetch Error:', error);
      toast.error('Failed to load products: ' + (error.message || 'Check if the "products" table exists in Supabase.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatus = (product: Product) => {
    if (product.stock_qty === 0) return { label: 'Out of Stock', variant: 'destructive' as const, icon: PackageX };
    if (product.stock_qty <= product.reorder_threshold) return { label: 'Low Stock', variant: 'warning' as const, icon: AlertTriangle };
    return { label: 'In Stock', variant: 'success' as const, icon: CheckCircle2 };
  };

  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white h-20">
        <div>
          <h2 className="text-xl font-semibold text-slate-700">Inventory Management</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading} className="border-border">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white hover:bg-primary/90 font-medium shadow-sm transition-all" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Add Product
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search by name or SKU..." 
              className="pl-10 h-10 bg-white border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden lg:flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold uppercase border border-emerald-100">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               In Stock: {products.filter(p => p.stock_qty > p.reorder_threshold).length}
             </div>
             <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold uppercase border border-amber-100">
               <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
               Low: {products.filter(p => p.stock_qty > 0 && p.stock_qty <= p.reorder_threshold).length}
             </div>
             <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold uppercase border border-rose-100">
               <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
               Out: {products.filter(p => p.stock_qty === 0).length}
             </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-slate-50 border-border">
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Product Name / SKU</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Variant</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Stock</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right h-12">Cost</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right h-12">Sell Price</TableHead>
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center h-12">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw className="h-8 w-8 animate-spin opacity-40" />
                    <p className="text-sm font-medium">Fetching inventory...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center text-slate-400">
                  {searchQuery ? 'No products found matching your search.' : 'Your inventory is empty.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const status = getStatus(product);
                return (
                  <TableRow key={product.id} className="hover:bg-slate-50 transition-colors border-border group">
                    <TableCell className="px-6 py-4">
                      <p className="font-medium text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{product.sku}</p>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-slate-600">{product.variant}</TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="font-mono font-medium text-slate-800">{product.stock_qty}</span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-slate-500">{formatIDR(product.cost_price)}</TableCell>
                    <TableCell className="px-4 py-4 text-right text-slate-800 font-medium">{formatIDR(product.sell_price)}</TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      <Badge 
                        variant="outline"
                        className={cn(
                          "px-2 py-1 text-[10px] font-bold uppercase rounded-full shadow-none border-none",
                          status.variant === 'success' && "bg-emerald-100 text-emerald-700",
                          status.variant === 'warning' && "bg-amber-100 text-amber-700",
                          status.variant === 'destructive' && "bg-rose-100 text-rose-700"
                        )}
                      >
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <div className="bg-slate-50 px-6 py-4 border-t border-border flex justify-between items-center text-xs text-slate-500">
          <span>Showing {filteredProducts.length} of {products.length} products</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 rounded bg-white hover:bg-slate-50 border-border">Prev</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 rounded bg-white hover:bg-slate-50 border-border">Next</Button>
          </div>
        </div>
      </div>

      <AddProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchProducts} 
      />
    </div>
  );
}
