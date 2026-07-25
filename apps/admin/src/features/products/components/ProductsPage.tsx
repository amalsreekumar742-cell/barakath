import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { ProductProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatINR } from '@/utils/format';
import { fetchProducts } from '../api/fetchProducts';
import { fetchCategoriesForFilter } from '../api/fetchCategoriesForFilter';
import { deleteProduct } from '../api/deleteProduct';
import { exportProductsCSV } from '../api/exportProductsCSV';
import { countProducts } from '../api/countProducts';
import { setSearchTerm } from '../stores/productsSlice';
import ProductsFilter from './ProductsFilter';

const columnHelper = createColumnHelper<ProductProps>();

/** Derived status badge (spec §1.5): Archived wins, else stock-based. */
function statusBadge(p: ProductProps): { label: string; tone: string } {
  if (p.status === 'Archived') return { label: 'Archived', tone: 'bg-subtle text-muted' };
  if (p.stockStatus === 'Out of stock') return { label: 'Out of stock', tone: 'bg-error-subtle text-error' };
  if (p.stockStatus === 'Low stock') return { label: 'Low stock', tone: 'bg-warning-subtle text-warning' };
  return { label: 'Active', tone: 'bg-success-subtle text-success' };
}

/**
 * ProductsPage — the product listing (spec §1.5). Debounced search, collapsible filters, CSV export,
 * a @tanstack/react-table with thumbnail/price-range/status, cursor "View More" pagination (skill:
 * cursor, not page numbers), and row → edit / delete (ConfirmDialog). The count summary uses a server
 * aggregation. Price range is applied client-side over the loaded rows (product docs carry min/maxPrice).
 */
const ProductsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { products, hasMore, loading, loadingMore, error, lastVisible, filters, exportLoading, deleteLoading } =
    useAppSelector((s) => s.products);
  const categories = useAppSelector((s) => s.products.filterCategories);

  const [searchInput, setSearchInput] = useState(filters.searchTerm ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductProps | null>(null);

  // Categories (for the filter panel + count) once.
  useEffect(() => {
    if (categories.length === 0) void dispatch(fetchCategoriesForFilter());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Refetch page 1 + recount whenever filters change (setFilters clears the list).
  useEffect(() => {
    void dispatch(fetchProducts({ filters, cursor: null }));
    void countProducts(filters).then(setTotal).catch(() => setTotal(null));
  }, [dispatch, filters]);

  // Debounced search (300ms).
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.searchTerm ?? '') !== searchInput) dispatch(setSearchTerm(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Client-side price-range filter over the loaded rows.
  const visible = useMemo(
    () =>
      products.filter(
        (p) =>
          (filters.priceMin == null || p.maxPrice >= filters.priceMin) &&
          (filters.priceMax == null || p.minPrice <= filters.priceMax),
      ),
    [products, filters.priceMin, filters.priceMax],
  );

  const hasActiveFilters =
    !!filters.categoryId ||
    !!filters.subCategoryId ||
    !!filters.stockStatus ||
    !!filters.productStatus ||
    filters.priceMin != null ||
    filters.priceMax != null ||
    !!filters.searchTerm;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await dispatch(deleteProduct(deleteTarget.id));
    toast[deleteProduct.fulfilled.match(res) ? 'success' : 'error'](
      deleteProduct.fulfilled.match(res) ? 'Product deleted' : ((res.payload as string) ?? 'Could not delete'),
    );
    setDeleteTarget(null);
  };

  const priceLabel = (p: ProductProps) =>
    p.minPrice === p.maxPrice ? formatINR(p.minPrice) : `${formatINR(p.minPrice)} – ${formatINR(p.maxPrice)}`;

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Product',
        cell: (ctx) => (
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-subtle">
              {ctx.row.original.thumbnail ? (
                <img src={ctx.row.original.thumbnail} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <span className="text-[14px] font-semibold text-foreground">{ctx.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('sku', { header: 'SKU', cell: (c) => <span className="text-[13px] text-muted">{c.getValue()}</span> }),
      columnHelper.accessor('categoryName', { header: 'Category', cell: (c) => <span className="text-[13px] text-muted">{c.getValue()}</span> }),
      columnHelper.accessor('subCategoryName', { header: 'Sub-category', cell: (c) => <span className="text-[13px] text-muted">{c.getValue() || '—'}</span> }),
      columnHelper.display({ id: 'price', header: 'Price', cell: (c) => <span className="text-[13px] font-semibold text-foreground">{priceLabel(c.row.original)}</span> }),
      columnHelper.accessor('totalStock', { header: 'Stock', cell: (c) => <span className="text-[13px] text-muted">{c.getValue()}</span> }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: (c) => {
          const b = statusBadge(c.row.original);
          return <span className={`inline-flex rounded-sm px-2 py-0.5 text-[11px] font-bold ${b.tone}`}>{b.label}</span>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (c) => (
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/products/${c.row.original.id}/edit`); }} className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-primary" aria-label="Edit">
              <Icon name="EditLine" size={18} />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c.row.original); }} className="rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error" aria-label="Delete">
              <Icon name="CloseLine" size={18} />
            </button>
          </div>
        ),
      }),
    ],
    [navigate],
  );

  const table = useReactTable({ data: visible, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Products</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {total ?? '—'} products · {categories.length} categories
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/products/add')}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={18} /> Add product
        </button>
      </div>

      {/* Search + actions */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products by name or SKU…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-4 py-2.5 text-[14px] font-semibold ${
            showFilters || hasActiveFilters ? 'border-primary text-primary' : 'border-border-strong text-foreground hover:bg-subtle'
          }`}
        >
          <Icon name="Filter2Line" size={16} /> Filters
        </button>
        <button
          type="button"
          onClick={() => dispatch(exportProductsCSV(filters))}
          disabled={exportLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
        >
          {exportLoading ? <Icon name="Loader4Line" size={16} className="animate-spin" /> : <Icon name="ArrowDownLine" size={16} />}
          Export
        </button>
      </div>

      {showFilters && <ProductsFilter />}

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={64} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button type="button" onClick={() => dispatch(fetchProducts({ filters, cursor: null }))} className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark">
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="ShoppingBag3Line" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No products found</h2>
          {hasActiveFilters ? (
            <p className="mt-1 text-[14px] text-muted">Try adjusting your filters.</p>
          ) : (
            <>
              <p className="mt-1 text-[14px] text-muted">Add your first product to get started.</p>
              <button type="button" onClick={() => navigate('/products/add')} className="mt-4 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark">
                Add your first product
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-subtle/50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/products/${row.original.id}/edit`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {loadingMore && (
            <div className="p-3">
              <Skeleton height={44} borderRadius={8} />
            </div>
          )}
          {hasMore && !loadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button type="button" onClick={() => dispatch(fetchProducts({ filters, cursor: lastVisible }))} className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle">
                View More
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete product?"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This will permanently remove the product and all its variants. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ProductsPage;
