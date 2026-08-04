import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Skeleton from 'react-loading-skeleton';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import type { PaymentProps } from '@barakath/shared/types';
import { PaymentStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR, formatINRCompact } from '@/utils/format';
import { fetchPayments } from '../api/fetchPayments';
import { fetchPaymentStats } from '../api/fetchPaymentStats';
import { exportPaymentsCSV } from '../api/exportPaymentsCSV';
import { setPaymentStatusFilter, setPaymentSearch, setPaymentDateRange } from '../stores/paymentsSlice';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentBadges';
import PaymentDetailModal from './PaymentDetailModal';

const columnHelper = createColumnHelper<PaymentProps>();

/**
 * Status filters offered on the list.
 *
 * Pending and Failed are deliberately absent: they are still valid `PaymentStatus`
 * values, still rendered by `PaymentStatusBadge`, and still reachable under "All"
 * — they just no longer get a filter tab of their own. The filter state starts
 * empty and these tabs were the only way to set it, so removing them cannot strand
 * the list behind a filter the UI can't clear.
 */
const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Paid', value: PaymentStatus.PAID },
  { label: 'Refunded', value: PaymentStatus.REFUNDED },
];

/**
 * PaymentsPage — the payment list with a status filter, a date range, search and CSV export (spec
 * §1.9). A row opens the PaymentDetailModal; the order-id cell links straight to the order.
 *
 * WHY a single header subtitle rather than a stat-card grid: matches the design (`Barakath Admin
 * Panel.dc.html`, "13 · Payments" — `<h1>Payments</h1>` + one line, "₹X this month · N failed") and the
 * sibling OrdersPage's own real convention (no stat-card row there either) — an earlier version of this
 * page grew a 5-card summary grid neither the design nor any other admin listing page has.
 *
 * WHY there's no Method filter (Razorpay/Wallet/Both) here anymore: the design has no method filter row
 * at all, and no sibling admin listing page has a second filter dimension like this either — removed to
 * match. `paymentsSlice`'s method-filter state/thunk plumbing is left in place (always empty from this
 * page) in case it's wanted back later.
 */
const PaymentsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    payments,
    hasMore,
    loading,
    loadingMore,
    error,
    lastVisible,
    filters,
    stats,
    statsLoading,
    exportLoading,
  } = useAppSelector((s) => s.payments);

  const [searchInput, setSearchInput] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(fetchPaymentStats());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchPayments({ filters, cursor: null }));
  }, [dispatch, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.searchTerm !== searchInput) dispatch(setPaymentSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const setDates = (from: Date | null, to: Date | null) => {
    const toEnd = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59) : null;
    dispatch(
      setPaymentDateRange({
        dateFrom: from ? Timestamp.fromDate(from) : null,
        dateTo: toEnd ? Timestamp.fromDate(toEnd) : null,
      }),
    );
  };

  const searching = filters.searchTerm.trim().length > 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'Payment ID',
        cell: (c) => (
          <span title={c.getValue()} className="font-mono text-[12px] font-semibold text-foreground">
            {c.getValue().slice(0, 8)}…
          </span>
        ),
      }),
      columnHelper.accessor('orderId', {
        header: 'Order ID',
        cell: (c) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/orders/${c.getValue()}`);
            }}
            className="font-mono text-[12px] font-semibold text-primary hover:underline"
          >
            #{c.getValue().slice(0, 8)}…
          </button>
        ),
      }),
      columnHelper.accessor('userName', {
        header: 'Customer',
        cell: (c) => <span className="text-[13px] font-medium text-foreground">{c.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('amount', {
        header: 'Amount',
        cell: (c) => <span className="text-[13px] font-semibold text-foreground">{formatINR(c.getValue())}</span>,
      }),
      columnHelper.accessor('method', {
        header: 'Method',
        cell: (c) => <PaymentMethodBadge method={c.getValue()} />,
      }),
      columnHelper.accessor('razorpayPaymentId', {
        header: 'Razorpay ID',
        cell: (c) =>
          c.getValue() ? (
            <span className="font-mono text-[12px] text-muted">{c.getValue()}</span>
          ) : (
            <span className="text-[13px] text-faint">—</span>
          ),
      }),
      columnHelper.accessor('walletAmountUsed', {
        header: 'Wallet Used',
        cell: (c) =>
          c.getValue() > 0 ? (
            <span className="text-[13px] text-muted">{formatINR(c.getValue())}</span>
          ) : (
            <span className="text-[13px] text-faint">—</span>
          ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <PaymentStatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('gstAmount', {
        header: 'GST',
        cell: (c) => <span className="text-[13px] text-muted">{formatINR(c.getValue() ?? 0)}</span>,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Date',
        cell: (c) => (
          <span className="text-[13px] text-muted">
            {c.getValue() ? format(c.getValue().toDate(), 'dd MMM yyyy, hh:mm a') : '—'}
          </span>
        ),
      }),
    ],
    [navigate],
  );

  const table = useReactTable({ data: payments, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Payments</h1>
        {statsLoading ? (
          <Skeleton height={16} width={180} />
        ) : (
          <p className="mt-1 text-[13px] text-faint">
            {formatINRCompact(stats?.monthRevenue ?? 0)} this month
            {stats && stats.failedCount > 0 ? ` · ${stats.failedCount} failed` : ''}
          </p>
        )}
      </div>

      {/* Status pills */}
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = filters.status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => dispatch(setPaymentStatusFilter(tab.value))}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Date range + search + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order ID…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className={`orders-datepicker flex items-center gap-2 ${searching ? 'opacity-40' : ''}`}>
          <DatePicker
            selected={filters.dateFrom ? filters.dateFrom.toDate() : null}
            onChange={(d) => setDates(d, filters.dateTo ? filters.dateTo.toDate() : null)}
            selectsStart
            startDate={filters.dateFrom ? filters.dateFrom.toDate() : null}
            endDate={filters.dateTo ? filters.dateTo.toDate() : null}
            disabled={searching}
            placeholderText="From"
            dateFormat="dd MMM yyyy"
            className="w-32 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-primary"
          />
          <DatePicker
            selected={filters.dateTo ? filters.dateTo.toDate() : null}
            onChange={(d) => setDates(filters.dateFrom ? filters.dateFrom.toDate() : null, d)}
            selectsEnd
            startDate={filters.dateFrom ? filters.dateFrom.toDate() : null}
            endDate={filters.dateTo ? filters.dateTo.toDate() : null}
            minDate={filters.dateFrom ? filters.dateFrom.toDate() : undefined}
            disabled={searching}
            placeholderText="To"
            dateFormat="dd MMM yyyy"
            className="w-32 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-[13px] outline-none focus:border-primary"
          />
          {(filters.dateFrom || filters.dateTo) && (
            <button
              type="button"
              onClick={() => setDates(null, null)}
              className="rounded-md border border-border-strong p-2.5 text-muted hover:bg-subtle"
              aria-label="Clear dates"
            >
              <Icon name="CloseLine" size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => dispatch(exportPaymentsCSV(filters))}
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
            onClick={() => dispatch(fetchPayments({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="WalletLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No payments found</h2>
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
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-faint"
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
                  onClick={() => setDetailId(row.original.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-subtle/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
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
                onClick={() => dispatch(fetchPayments({ filters, cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}

      <PaymentDetailModal
        isOpen={!!detailId}
        paymentId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
};

export default PaymentsPage;
