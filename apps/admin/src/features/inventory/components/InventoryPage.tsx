import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Skeleton from 'react-loading-skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { fetchInventory } from '../api/fetchInventory';
import { fetchInventoryCounts } from '../api/fetchInventoryCounts';
import { exportInventoryCSV } from '../api/exportInventoryCSV';
import { setInventorySearch } from '../stores/inventorySlice';
import StockStatusBadge from './StockStatusBadge';
import type { InventoryRow } from '../types';

const columnHelper = createColumnHelper<InventoryRow>();

const relTime = (ts: InventoryRow['updatedAt']) =>
  ts ? formatDistanceToNow(ts.toDate(), { addSuffix: true }) : '—';

/**
 * InventoryPage — variant-level stock listing (design §08 Inventory): Product · SKU · Variant · In
 * stock · Status · Updated, with summary cards and cursor pagination. "Adjust stock" opens the batch
 * adjust page; search runs on product keywords (debounced).
 */
const InventoryPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { rows, hasMore, loading, loadingMore, error, lastVisible, filters, counts, exportLoading } =
    useAppSelector((s) => s.inventory);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    void dispatch(fetchInventoryCounts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchInventory({ filters, cursor: null }));
  }, [dispatch, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.searchTerm ?? '') !== searchInput) dispatch(setInventorySearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const totalProducts = counts.inStock + counts.lowStock + counts.outOfStock;

  const cards = [
    { label: 'In stock', value: counts.inStock, tone: 'text-success' },
    { label: 'Low stock', value: counts.lowStock, tone: 'text-gold-strong' },
    { label: 'Out of stock', value: counts.outOfStock, tone: 'text-error' },
    { label: 'Total SKUs', value: counts.totalSkus, tone: 'text-foreground' },
  ];

  const columns = useMemo(
    () => [
      columnHelper.accessor('productName', {
        header: 'Product',
        cell: (c) => <span className="text-[13px] font-bold text-foreground">{c.getValue()}</span>,
      }),
      columnHelper.accessor('sku', {
        header: 'SKU',
        cell: (c) => <span className="font-mono text-[12px] text-muted">{c.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'variant',
        header: 'Variant',
        cell: (c) =>
          c.row.original.variantLabel === '—' ? (
            <span className="text-[13px] text-muted">—</span>
          ) : (
            <span className="inline-flex items-center gap-2 text-[13px] text-muted">
              <span
                className="h-3.5 w-3.5 rounded-full border border-border"
                style={{ backgroundColor: c.row.original.colorCode }}
              />
              {c.row.original.variantLabel}
            </span>
          ),
      }),
      columnHelper.accessor('stock', {
        header: 'In stock',
        cell: (c) => <span className="text-[13px] font-semibold text-foreground">{c.getValue()}</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <StockStatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('updatedAt', {
        header: 'Updated',
        cell: (c) => <span className="text-[13px] text-muted">{relTime(c.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: () => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/inventory/adjust')}
              className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-primary"
              aria-label="Adjust stock"
            >
              <Icon name="ToolsLine" size={18} />
            </button>
          </div>
        ),
      }),
    ],
    [navigate],
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Inventory</h1>
          <p className="mt-0.5 text-[13px] text-muted">Stock levels across {totalProducts} products</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/inventory/adjust')}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle"
          >
            <Icon name="ToolsLine" size={16} /> Adjust stock
          </button>
          <button
            type="button"
            onClick={() => dispatch(exportInventoryCSV(filters))}
            disabled={exportLoading}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {exportLoading ? (
              <Icon name="Loader4Line" size={16} className="animate-spin" />
            ) : (
              <Icon name="ArrowDownLine" size={16} />
            )}
            Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-[12px] font-medium text-muted">{card.label}</p>
            <p className={`mt-2 text-[24px] font-extrabold tabular-nums ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by product name or SKU…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={52} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchInventory({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="MenuLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No products match your filters</h2>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full">
            <thead className="border-b border-border bg-subtle/50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-subtle/40">
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
              <button
                type="button"
                onClick={() => dispatch(fetchInventory({ filters, cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
