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
import type { OrderProps } from '@barakath/shared/types';
import { OrderStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { formatINR } from '@/utils/format';
import { fetchOrders } from '../api/fetchOrders';
import { fetchOrderStatusCounts } from '../api/fetchOrderStatusCounts';
import { exportOrdersCSV } from '../api/exportOrdersCSV';
import { setStatusFilter, setOrderSearch, setOrderDateRange } from '../stores/ordersSlice';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentBadges';
import type { OrderStatusCounts } from '../types';

const columnHelper = createColumnHelper<OrderProps>();

const TABS: { label: string; value: string; key: keyof OrderStatusCounts }[] = [
  { label: 'All', value: '', key: 'all' },
  { label: 'Pending', value: OrderStatus.PENDING, key: 'pending' },
  { label: 'Accepted', value: OrderStatus.ACCEPTED, key: 'accepted' },
  { label: 'Packed', value: OrderStatus.PACKED, key: 'packed' },
  { label: 'Shipped', value: OrderStatus.SHIPPED, key: 'shipped' },
  { label: 'Out for delivery', value: OrderStatus.OUT_FOR_DELIVERY, key: 'outForDelivery' },
  { label: 'Delivered', value: OrderStatus.DELIVERED, key: 'delivered' },
  { label: 'Cancelled', value: OrderStatus.CANCELLED, key: 'cancelled' },
];

/**
 * OrdersPage — the order list with status tabs, search, date-range filter and CSV export (spec §1.7).
 * Tabs show live counts; changing tab/search/date resets the list and refetches page one.
 */
const OrdersPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    orders,
    hasMore,
    loading,
    loadingMore,
    error,
    lastVisible,
    filters,
    statusCounts,
    exportLoading,
  } = useAppSelector((s) => s.orders);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    void dispatch(fetchOrderStatusCounts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchOrders({ filters, cursor: null }));
  }, [dispatch, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.searchTerm !== searchInput) dispatch(setOrderSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const setDates = (from: Date | null, to: Date | null) => {
    // Include the whole `to` day by pushing it to 23:59:59.
    const toEnd = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59) : null;
    dispatch(
      setOrderDateRange({
        dateFrom: from ? Timestamp.fromDate(from) : null,
        dateTo: toEnd ? Timestamp.fromDate(toEnd) : null,
      }),
    );
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'Order ID',
        cell: (c) => (
          <span title={c.getValue()} className="font-mono text-[12px] font-semibold text-foreground">
            #{c.getValue().slice(0, 8)}…
          </span>
        ),
      }),
      columnHelper.accessor('userName', {
        header: 'Customer',
        cell: (c) => <span className="text-[13px] font-medium text-foreground">{c.getValue()}</span>,
      }),
      columnHelper.accessor('userPhone', {
        header: 'Phone',
        cell: (c) => <span className="text-[13px] text-muted">{c.getValue()}</span>,
      }),
      columnHelper.display({
        id: 'items',
        header: 'Items',
        cell: (c) => <span className="text-[13px] text-muted">{c.row.original.items?.length ?? 0}</span>,
      }),
      columnHelper.accessor('grandTotal', {
        header: 'Total',
        cell: (c) => <span className="text-[13px] font-semibold text-foreground">{formatINR(c.getValue())}</span>,
      }),
      columnHelper.accessor('paymentMethod', {
        header: 'Payment',
        cell: (c) => <PaymentMethodBadge method={c.getValue()} />,
      }),
      columnHelper.accessor('paymentStatus', {
        header: 'Payment Status',
        cell: (c) => <PaymentStatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <OrderStatusBadge status={c.getValue()} />,
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
    [],
  );

  const table = useReactTable({ data: orders, columns, getCoreRowModel: getCoreRowModel() });

  const activeTabLabel = TABS.find((t) => t.value === filters.status)?.label ?? '';

  return (
    <div className="p-6">
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-foreground">Orders</h1>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = filters.status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => dispatch(setStatusFilter(tab.value))}
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

      {/* Search + date range + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order ID, customer or phone…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="orders-datepicker flex items-center gap-2">
          <DatePicker
            selected={filters.dateFrom ? filters.dateFrom.toDate() : null}
            onChange={(d) => setDates(d, filters.dateTo ? filters.dateTo.toDate() : null)}
            selectsStart
            startDate={filters.dateFrom ? filters.dateFrom.toDate() : null}
            endDate={filters.dateTo ? filters.dateTo.toDate() : null}
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
          onClick={() => dispatch(exportOrdersCSV(filters))}
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
            onClick={() => dispatch(fetchOrders({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="ShoppingBag1Line" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">
            {activeTabLabel && activeTabLabel !== 'All' ? `No ${activeTabLabel.toLowerCase()} orders` : 'No orders found'}
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
                  onClick={() => navigate(`/orders/${row.original.id}`)}
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
                onClick={() => dispatch(fetchOrders({ filters, cursor: lastVisible }))}
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

export default OrdersPage;
