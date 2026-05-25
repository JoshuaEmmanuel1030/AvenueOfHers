import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Plus, RefreshCw, Search, Pencil, Package, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Product, ProductWithVariants } from '@/types';
import { CatalogueProductModal } from '@/components/catalogue/CatalogueProductModal';

export function CataloguePage({
  dataVersion = 0,
  onCatalogueChanged,
}: {
  dataVersion?: number;
  onCatalogueChanged?: () => void;
}) {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('is_archived', showArchived)
        .order('name');
      if (error) throw error;
      setProducts((data as ProductWithVariants[]) || []);
    } catch (err: any) {
      toast.error('Failed to load catalogue: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [showArchived, dataVersion]);

  const collections = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.collection && set.add(p.collection));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (collectionFilter !== 'all' && p.collection !== collectionFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.collection ?? '').toLowerCase().includes(q)
      );
    });
  }, [products, search, collectionFilter]);

  const handleNew = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  const handleArchive = async (productId: string, archive: boolean) => {
    setArchiveLoading(true);
    try {
      const { error } = await supabase.from('products').update({ is_archived: archive }).eq('id', productId);
      if (error) throw error;
      toast.success(archive ? 'Product archived.' : 'Product restored.');
      setArchivingId(null);
      fetchProducts();
      onCatalogueChanged?.();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 -mx-8 px-8 bg-white min-h-20 py-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-700">Catalogue</h2>
          <p className="text-xs text-slate-400 mt-0.5">Product listings — define what you sell before stocking it.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading} className="border-border">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(v => !v)}
            className={cn('gap-1.5 border-border font-medium', showArchived && 'bg-slate-100')}
          >
            <Archive size={14} /> {showArchived ? 'Showing Archived' : 'Archived'}
          </Button>
          {!showArchived && (
            <Button size="sm" onClick={handleNew} className="gap-2 bg-primary text-white hover:bg-primary/90 font-medium shadow-sm">
              <Plus size={18} /> New Product
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, category, collection..."
            className="pl-9 h-10 border-border"
          />
        </div>
        {collections.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {collections.map(c => (
              <button
                key={c}
                onClick={() => setCollectionFilter(c)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-colors',
                  collectionFilter === c
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-500 border-border hover:bg-slate-100'
                )}
              >
                {c === 'all' ? 'All Collections' : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-border shadow-sm p-5 animate-pulse">
              <div className="h-4 w-32 bg-slate-100 rounded mb-3" />
              <div className="h-3 w-20 bg-slate-100 rounded mb-5" />
              <div className="h-3 w-full bg-slate-100 rounded mb-2" />
              <div className="h-3 w-3/4 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-border shadow-sm p-16 text-center">
          <Package size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">
            {products.length === 0
              ? showArchived ? 'No archived products.' : 'No products in catalogue yet.'
              : 'No products match your search.'}
          </p>
          {!showArchived && products.length === 0 && (
            <Button onClick={handleNew} className="mt-4 gap-2 bg-primary text-white hover:bg-primary/90">
              <Plus size={16} /> Add Your First Product
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(p => (
            <CatalogueCard
              key={p.id}
              product={p}
              onEdit={() => handleEdit(p)}
              archiving={archivingId === p.id}
              archiveLoading={archiveLoading}
              onArchiveStart={() => setArchivingId(p.id)}
              onArchiveCancel={() => setArchivingId(null)}
              onArchiveConfirm={() => handleArchive(p.id, !p.is_archived)}
            />
          ))}
        </div>
      )}

      <CatalogueProductModal
        open={modalOpen}
        product={editingProduct}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          fetchProducts();
          onCatalogueChanged?.();
        }}
      />
    </div>
  );
}

interface CatalogueCardProps {
  product: ProductWithVariants;
  onEdit: () => void;
  archiving: boolean;
  archiveLoading: boolean;
  onArchiveStart: () => void;
  onArchiveCancel: () => void;
  onArchiveConfirm: () => void;
}

const CatalogueCard: React.FC<CatalogueCardProps> = ({
  product,
  onEdit,
  archiving,
  archiveLoading,
  onArchiveStart,
  onArchiveCancel,
  onArchiveConfirm,
}) => {
  const variantCount = product.product_variants?.length ?? 0;
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{product.name}</h3>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            {product.category && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{product.category}</span>
            )}
            {product.collection && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                {product.collection}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!product.is_archived && (
            <button
              onClick={onEdit}
              title="Edit"
              className="p-1.5 rounded text-slate-400 hover:text-primary hover:bg-slate-50 transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
          {!archiving && (
            <button
              onClick={onArchiveStart}
              title={product.is_archived ? 'Restore' : 'Archive'}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {product.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
          )}
        </div>
      </div>

      {archiving && (
        <div className="flex items-center justify-end gap-1.5 -mt-2">
          <span className="text-[11px] text-slate-500 mr-1">{product.is_archived ? 'Restore?' : 'Archive?'}</span>
          <button
            onClick={onArchiveConfirm}
            disabled={archiveLoading}
            className="px-2 py-0.5 text-[11px] font-bold rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
          >
            Yes
          </button>
          <button
            onClick={onArchiveCancel}
            disabled={archiveLoading}
            className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            No
          </button>
        </div>
      )}

      {product.description && (
        <p className="text-xs text-slate-500 line-clamp-2">{product.description}</p>
      )}

      <div className="space-y-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sizes</p>
          <div className="flex flex-wrap gap-1">
            {product.available_sizes?.length ? (
              product.available_sizes.map(s => (
                <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-50 text-slate-600 border border-border">
                  {s}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-400 italic">Not set</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Colors</p>
          <div className="flex flex-wrap gap-1">
            {product.available_colors?.length ? (
              product.available_colors.map(c => (
                <span key={c} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-border">
                  {c}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-400 italic">Not set</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3 mt-auto flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {variantCount} {variantCount === 1 ? 'variant' : 'variants'} stocked
        </span>
      </div>
    </div>
  );
};
