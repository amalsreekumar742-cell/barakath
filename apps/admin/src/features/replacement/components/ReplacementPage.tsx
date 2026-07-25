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
import type { ReplacementProps } from '@barakath/shared/types';
import { ReplacementStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatShortDate } from '@/utils/format';
import { fetchReplacements } from '../api/fetchReplacements';
import { fetchReplacementStatusCounts } from '../api/fetchReplacementStatusCounts';
import { exportReplacementsCSV } from '../api/exportReplacementsCSV';
import { setReplacementTab, setReplacementSearch } from '../stores/replacementSlice';
import ReplacementStatusBadge from './ReplacementStatusBadge';
import type { ReplacementStatusCounts } from '../types';

const columnHelper = createColumnHelper<ReplacementProps>();

type ReplacementTab = 'Pending' | 'Approved' | 'Rejected';

const TABS: { label: string; value: ReplacementTab; key: keyof ReplacementStatusCounts }[] = [
  { label: 'Pending', value: ReplacementStatus.PENDING, key: 'pending' },
  { label: 'Approved', value: ReplacementStatus.APPROVED, key: 'approved' },
  { label: 'Rejected', value: ReplacementStatus.REJECTED, key: 'rejected' },
];

/**
 * ReplacementPage — the replacement-request list with Pending/Approved/Rejected tabs and search (spec
 * §1.10). Each tab is a cursor-paginated view of one status; switching tab/search resets the list and
 * refetches page one. Tabs show live counts. A row opens the request detail; the Order ID cell links
 * straight to the source order (without opening the detail).
 */
const ReplacementPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    replacements,
    hasMore,
    loading,
    loadingMore,
    error,
    lastVisible,
    filters,
    activeTab,
    statusCounts,
    exportLoading,
  } = useAppSelector((s) => s.replacement);

  const [searchInput, setSearchInput] = useState('');

  const runExport = async () => {
    const res = await dispatch(exportReplacementsCSV(filters));
    if (exportReplacementsCSV.fulfilled.match(res)) toast.success('Replacements exported');
    else toast.error((res.payload as string) ?? 'Could not export replacements');
  };

  // One-time (per mount) load of the tab counts.
  useEffect(() => {
    void dispatch(fetchReplacementStatusCounts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Refetch page one whenever the active filters (tab / search) change.
  useEffect(() => {
    void dispatch(fetchReplacements({ filters, cursor: null }));
  }, [dispatch, filters]);

  // Debounce the search box (300ms) before it hits the store + a query.
  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.searchTerm !== searchInput) dispatch(setReplacementSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'Request ID',
        cell: (c) => (
          <span title={c.getValue()} className="font-mono text-[12px] font-semibold text-foreground">
            #{c.getValue().slice(0, 8)}
          </span>
        ),
      }),
      columnHelper.accessor('orderId', {
        header: 'Order ID',
        cell: (c) => (
          <button
            type="button"
            title={c.getValue()}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/orders/${c.getValue()}`);
            }}
            className="font-mono text-[12px] font-semibold text-primary hover:underline"
          >
            #{c.getValue().slice(0, 8)}
          </button>
        ),
      }),
      columnHelper.accessor('userName', {
        header: 'Customer',
        cell: (c) => <span className="text-[13px] font-medium text-foreground">{c.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'product',
        header: 'Product',
        cell: (c) => {
          const r = c.row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-subtle">
                {r.productImage ? (
                  <img src={r.productImage} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="max-w-[180px] truncate text-[13px] font-medium text-foreground" title={r.productName}>
                {r.productName}
              </span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'variant',
        header: 'Variant',
        cell: (c) => {
          const r = c.row.original;
          return (
            <div className="flex items-center gap-1.5 text-[13px] text-muted">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-border"
                style={{ backgroundColor: r.variantColor }}
              />
              {r.variantName}
            </div>
          );
        },
      }),
      columnHelper.accessor('quantity', {
        header: 'Qty',
        cell: (c) => <span className="text-[13px] text-muted">{c.getValue()}</span>,
      }),
      columnHelper.accessor('reason', {
        header: 'Reason',
        cell: (c) => (
          <span className="block max-w-[200px] truncate text-[13px] text-muted" title={c.getValue()}>
            {c.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <ReplacementStatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Date',
        cell: (c) => <span className="text-[13px] text-muted">{formatShortDate(c.getValue())}</span>,
      }),
    ],
    [navigate],
  );

  const table = useReactTable({ data: replacements, columns, getCoreRowModel: getCoreRowModel() });

  const activeLabel = TABS.find((t) => t.value === activeTab)?.label ?? '';

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Replacement</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {statusCounts.pending} pending · {statusCounts.approved} approved · {statusCounts.rejected} rejected
        </p>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => dispatch(setReplacementTab(tab.value))}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab.label}{' '}
              <span className={`tabular-nums ${active ? 'text-primary' : 'text-faint'}`}>
                ({statusCounts[tab.key]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by customer name or phone…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={runExport}
          disabled={exportLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:opacity-50"
        >
          {exportLoading ? (
            <Icon name="Loader4Line" size={16} className="animate-spin" />
          ) : (
            <Icon name="ArrowDownLine" size={16} />
          )}
          Export CSV
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={52} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchReplacements({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : replacements.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="ToolsLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">
            No {activeLabel.toLowerCase()} replacement requests
          </h2>
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
                <tr
                  key={row.id}
                  onClick={() => navigate(`/replacement/${row.original.id}`)}
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
              <button
                type="button"
                onClick={() => dispatch(fetchReplacements({ filters, cursor: lastVisible }))}
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

export default ReplacementPage;
