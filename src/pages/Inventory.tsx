import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ProductWithVariants, ProductVariant } from '@/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search, RefreshCw, Pencil, PackagePlus, PackageMinus, PlusCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { AddVariantModal } from '@/components/inventory/AddVariantModal';
import { EditVariantModal } from '@/components/inventory/EditVariantModal';
import { StockAdjustModal } from '@/components/inventory/StockAdjustModal';
import { cn } from '@/lib/utils';

const formatIDR = (amount: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const getStatus = (v: ProductVariant) => {
  if (v.stock_qty === 0) return { label: 'Out of Stock', color: 'bg-rose-100 text-rose-700' };
  if (v.stock_qty <= v.reorder_threshold) return { label: 'Low Stock', color: 'bg-amber-100 text-amber-700' };
  return { label: 'In Stock', color: 'bg-emerald-100 text-emerald-700' };
};

type FlatVariant = ProductVariant & { productName: string; category: string | null };

export function InventoryPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addVariantProduct, setAddVariantProduct] = useState<{ product: ProductWithVariants } | null>(null);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [adjustingVariant, setAdjustingVariant] = useState<FlatVariant | null>(null);
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('is_archived', false)
        .order('name');

      if (error) throw error;
      setProducts((data as ProductWithVariants[]) || []);
    } catch (error: any) {
      toast.error('Failed to load inventory: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const allVariants: FlatVariant[] = products.flatMap(p =>
    p.product_variants.map(v => ({ ...v, productName: p.name, category: p.category }))
  );

  const filtered = searchQuery
    ? allVariants.filter(v =>
        v.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.color.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.size.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allVariants;

  const inStock = allVariants.filter(v => v.stock_qty > v.reorder_threshold).length;
  const lowStock = allVariants.filter(v => v.stock_qty > 0 && v.stock_qty <= v.reorder_threshold).length;
  const outOfStock = allVariants.filter(v => v.stock_qty === 0).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white h-20">
        <h2 className="text-xl font-semibold text-slate-700">Inventory Management</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading} className="border-border">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button size="sm" className="gap-2 bg-primary text-white hover:bg-primary/90 font-medium shadow-sm" onClick={() => setIsAddOpen(true)}>
            <Plus size={18} /> Add Product
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              placeholder="Search by name, SKU, size, or color..."
              className="pl-10 h-10 bg-white border-border"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <Chip color="emerald" label={`In Stock: ${inStock}`} />
            <Chip color="amber" label={`Low: ${lowStock}`} />
            <Chip color="rose" label={`Out: ${outOfStock}`} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-slate-50 border-border">
              <TableHead className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Product</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Size</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">Color</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12">SKU</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-center">Stock</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-right">Cost</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-right">Sell Price</TableHead>
              <TableHead className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest h-12 text-center">Status</TableHead>
              <TableHead className="px-4 py-3 h-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-64 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto opacity-20" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-64 text-center text-slate-400">
                  {searchQuery ? 'No results found.' : 'Your inventory is empty. Add a product to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v, i) => {
                const status = getStatus(v);
                const isNewProduct = i === 0 || filtered[i - 1].productName !== v.productName;
                return (
                  <TableRow
                    key={v.id}
                    className={cn(
                      'hover:bg-slate-50 transition-colors border-border group',
                      isNewProduct && i !== 0 && 'border-t-2 border-t-slate-200'
                    )}
                  >
                    <TableCell className="px-6 py-4">
                      {isNewProduct ? (
                        <div className="flex items-center justify-between group/product">
                          <div>
                            <p className="font-medium text-slate-800">{v.productName}</p>
                            {v.category && <p className="text-[10px] text-slate-400 uppercase tracking-wide">{v.category}</p>}
                          </div>
                          <button
                            type="button"
                            title="Add variant"
                            onClick={() => {
                              const product = products.find(p => p.name === v.productName);
                              if (product) setAddVariantProduct({ product });
                            }}
                            className="opacity-0 group-hover/product:opacity-100 p-1 rounded-md hover:bg-slate-100 transition-all text-primary"
                          >
                            <PlusCircle size={15} />
                          </button>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-slate-600 text-sm">{v.size}</TableCell>
                    <TableCell className="px-4 py-4 text-slate-600 text-sm">{v.color}</TableCell>
                    <TableCell className="px-4 py-4 font-mono text-xs text-slate-400">{v.sku}</TableCell>
                    <TableCell className="px-4 py-4 text-center font-mono font-medium text-slate-800">{v.stock_qty}</TableCell>
                    <TableCell className="px-4 py-4 text-right text-slate-500 text-sm">{formatIDR(v.cost_price)}</TableCell>
                    <TableCell className="px-4 py-4 text-right font-medium text-slate-800 text-sm">{formatIDR(v.sell_price)}</TableCell>
                    <TableCell className="px-4 py-4 text-center">
                      <Badge variant="outline" className={cn('px-2 py-1 text-[10px] font-bold uppercase rounded-full shadow-none border-none', status.color)}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <ActionBtn title="Stock In" onClick={() => { setAdjustType('in'); setAdjustingVariant(v); }}>
                          <PackagePlus size={14} className="text-emerald-600" />
                        </ActionBtn>
                        <ActionBtn title="Stock Out" onClick={() => { setAdjustType('out'); setAdjustingVariant(v); }}>
                          <PackageMinus size={14} className="text-rose-500" />
                        </ActionBtn>
                        <ActionBtn title="Edit" onClick={() => setEditingVariant(v)}>
                          <Pencil size={14} className="text-slate-500" />
                        </ActionBtn>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="bg-slate-50 px-6 py-3 border-t border-border text-xs text-slate-400">
          {(() => {
            const uniqueProducts = new Set(filtered.map(v => v.productName)).size;
            return `${filtered.length} variant${filtered.length !== 1 ? 's' : ''} across ${uniqueProducts} product${uniqueProducts !== 1 ? 's' : ''}`;
          })()}
        </div>
      </div>

      <AddProductModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onSuccess={fetchProducts} />
      <AddVariantModal
        product={addVariantProduct?.product ?? null}
        existingVariantCount={addVariantProduct?.product.product_variants.length ?? 0}
        onClose={() => setAddVariantProduct(null)}
        onSuccess={fetchProducts}
      />
      <EditVariantModal variant={editingVariant} onClose={() => setEditingVariant(null)} onSuccess={fetchProducts} />
      <StockAdjustModal
        variant={adjustingVariant}
        productName={adjustingVariant?.productName ?? ''}
        initialType={adjustType}
        onClose={() => setAdjustingVariant(null)}
        onSuccess={fetchProducts}
      />
    </div>
  );
}

function Chip({ color, label }: { color: 'emerald' | 'amber' | 'rose'; label: string }) {
  const styles = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  const dotColors = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };
  return (
    <div className={cn('flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase border', styles[color])}>
      <div className={cn('w-1.5 h-1.5 rounded-full', dotColors[color])} />
      {label}
    </div>
  );
}

function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
    >
      {children}
    </button>
  );
}
