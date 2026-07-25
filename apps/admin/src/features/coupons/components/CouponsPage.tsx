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
import type { CouponProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatINR, formatShortDate } from '@/utils/format';
import { fetchCoupons } from '../api/fetchCoupons';
import { fetchCouponCount } from '../api/fetchCouponCount';
import { deleteCoupon } from '../api/deleteCoupon';
import { toggleCouponActive } from '../api/toggleCouponActive';
import { setCouponSearch } from '../stores/couponsSlice';

const columnHelper = createColumnHelper<CouponProps>();

/** True if the coupon's window has ended (validUntil at or before now). */
const isExpired = (c: CouponProps) => c.validUntil.toMillis() <= Date.now();

/** Compute the display status + badge classes (spec §1.12: Active green / Expired gray / Inactive red). */
function statusBadge(c: CouponProps): { label: string; cls: string } {
  if (!c.isActive) return { label: 'Inactive', cls: 'bg-error-subtle text-error' };
  if (isExpired(c)) return { label: 'Expired', cls: 'bg-subtle text-muted' };
  return { label: 'Active', cls: 'bg-success-subtle text-success' };
}

/**
 * CouponsPage — the coupon list with search, table, per-row actions and pagination (spec §1.12 listing;
 * the design is a single list, no status tabs — the Status column carries the Active/Expired/Inactive
 * label instead). The title shows the collection-wide count; changing search resets the list.
 */
const CouponsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { coupons, hasMore, loading, loadingMore, error, lastVisible, filters, count } = useAppSelector(
    (s) => s.coupons,
  );

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    void dispatch(fetchCouponCount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchCoupons({ filters, cursor: null }));
  }, [dispatch, filters]);

  // Debounced search (300ms) — pushes into the slice, which resets the list and refetches page one.
  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.searchTerm !== searchInput) dispatch(setCouponSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('code', {
        header: 'Code',
        cell: (c) => (
          <span className="font-mono text-[13px] font-bold text-foreground">{c.getValue()}</span>
        ),
      }),
      columnHelper.accessor('description', {
        header: 'Description',
        cell: (c) => (
          <span title={c.getValue()} className="block max-w-[220px] truncate text-[13px] text-muted">
            {c.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'discount',
        header: 'Discount',
        cell: (c) => {
          const row = c.row.original;
          return (
            <span className="text-[13px] font-semibold text-foreground">
              {row.discountType === 'Percentage' ? `${row.discountValue}%` : formatINR(row.discountValue)}
            </span>
          );
        },
      }),
      columnHelper.accessor('minimumOrderAmount', {
        header: 'Min Order',
        cell: (c) => <span className="text-[13px] text-muted">{formatINR(c.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'maxDiscount',
        header: 'Max Discount',
        cell: (c) => {
          const row = c.row.original;
          return (
            <span className="text-[13px] text-muted">
              {row.discountType === 'Percentage' ? formatINR(row.maximumDiscount) : '—'}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'usage',
        header: 'Usage',
        cell: (c) => {
          const row = c.row.original;
          const pct = row.usageLimit > 0 ? Math.min(100, (row.usedCount / row.usageLimit) * 100) : 0;
          return (
            <div className="min-w-[90px]">
              <span className="text-[12px] font-medium tabular-nums text-foreground">
                {row.usedCount}/{row.usageLimit}
              </span>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-pill bg-subtle">
                <div className="h-full rounded-pill bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('validUntil', {
        header: 'Valid Until',
        cell: (c) => {
          const expired = isExpired(c.row.original);
          return (
            <span className={`text-[13px] ${expired ? 'font-semibold text-error' : 'text-muted'}`}>
              {formatShortDate(c.getValue())}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'status',
        header: 'Status',
        cell: (c) => {
          const { label, cls } = statusBadge(c.row.original);
          return (
            <span className={`inline-flex rounded-pill px-2.5 py-1 text-[11px] font-bold ${cls}`}>
              {label}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (c) => <RowActions coupon={c.row.original} />,
      }),
    ],
    [],
  );

  const table = useReactTable({ data: coupons, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Coupons</h1>
          <p className="mt-1 text-[13px] text-muted">
            {count} {count === 1 ? 'coupon' : 'coupons'} · rules &amp; eligibility
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/coupons/create')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Create Coupon
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by code or description…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
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
            onClick={() => dispatch(fetchCoupons({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="GiftLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No coupons found</h2>
          <button
            type="button"
            onClick={() => navigate('/coupons/create')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Create your first coupon
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[900px]">
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
                onClick={() => dispatch(fetchCoupons({ filters, cursor: lastVisible }))}
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

/**
 * RowActions — Edit / active-toggle / delete for one coupon row (spec §1.12 + §1.22: every action is
 * confirmed with a dialog + toast). WHY its own component reading the store: keeps the toggle's per-row
 * spinner (toggleLoading === id) and each row's confirm-dialog state local, so the memoized column
 * definitions stay static and only the affected row re-renders.
 */
const RowActions: FC<{ coupon: CouponProps }> = ({ coupon }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toggleLoading = useAppSelector((s) => s.coupons.toggleLoading);
  const deleteLoading = useAppSelector((s) => s.coupons.deleteLoading);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggling = toggleLoading === coupon.id;

  // Flip active state after confirmation, then toast the outcome.
  const onToggle = async () => {
    const next = !coupon.isActive;
    const res = await dispatch(toggleCouponActive({ couponId: coupon.id, isActive: next }));
    setConfirmToggle(false);
    if (toggleCouponActive.fulfilled.match(res)) {
      toast.success(next ? 'Coupon activated' : 'Coupon deactivated');
    } else {
      toast.error((res.payload as string) ?? 'Could not update coupon');
    }
  };

  // Hard-delete after confirmation, then toast the outcome.
  const onDelete = async () => {
    const res = await dispatch(deleteCoupon(coupon.id));
    setConfirmDelete(false);
    if (deleteCoupon.fulfilled.match(res)) toast.success('Coupon deleted');
    else toast.error((res.payload as string) ?? 'Could not delete coupon');
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => navigate(`/coupons/${coupon.id}/edit`)}
        className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-foreground"
        aria-label="Edit coupon"
      >
        <Icon name="EditLine" size={16} />
      </button>

      {/* Active toggle — opens a confirm dialog (spec §1.22: toggles are confirmed). */}
      <button
        type="button"
        onClick={() => setConfirmToggle(true)}
        disabled={toggling}
        aria-label={coupon.isActive ? 'Deactivate coupon' : 'Activate coupon'}
        className="flex items-center px-1 disabled:opacity-50"
      >
        {toggling ? (
          <Icon name="Loader4Line" size={16} className="animate-spin text-muted" />
        ) : (
          <span
            className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${coupon.isActive ? 'bg-primary' : 'bg-border-strong'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${coupon.isActive ? 'left-[18px]' : 'left-0.5'}`}
            />
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error"
        aria-label="Delete coupon"
      >
        <Icon name="CloseLine" size={16} />
      </button>

      <ConfirmDialog
        isOpen={confirmToggle}
        title={coupon.isActive ? 'Deactivate coupon?' : 'Activate coupon?'}
        message={
          coupon.isActive
            ? `Customers will no longer be able to use "${coupon.code}".`
            : `"${coupon.code}" will become usable at checkout.`
        }
        confirmLabel={coupon.isActive ? 'Deactivate' : 'Activate'}
        confirmVariant={coupon.isActive ? 'danger' : 'primary'}
        loading={toggling}
        onConfirm={onToggle}
        onCancel={() => setConfirmToggle(false)}
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete coupon?"
        message={`This permanently deletes "${coupon.code}". This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default CouponsPage;
