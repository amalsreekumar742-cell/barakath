import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';
import type { UserProps } from '@barakath/shared/types';
import { UserStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchCustomers } from '../api/fetchCustomers';
import { fetchCustomerCount } from '../api/fetchCustomerCount';
import { exportCustomersCSV } from '../api/exportCustomersCSV';
import { setCustomerStatusFilter, setCustomerSearch } from '../stores/customersSlice';
import { Avatar, CustomerStatusBadge } from './ui';

const columnHelper = createColumnHelper<UserProps>();

const TABS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Active', value: UserStatus.ACTIVE },
  { label: 'Blocked', value: UserStatus.BLOCKED },
];

/**
 * CustomersPage — the customer list with a header count, search, status pills and CSV export (spec §1.8).
 * Changing pill/search resets the list and refetches page one; a row click opens the customer detail.
 */
const CustomersPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    customers,
    hasMore,
    loading,
    loadingMore,
    error,
    lastVisible,
    filters,
    counts,
    exportLoading,
  } = useAppSelector((s) => s.customers);

  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    void dispatch(fetchCustomerCount());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    void dispatch(fetchCustomers({ filters, cursor: null }));
  }, [dispatch, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (filters.searchTerm !== searchInput) dispatch(setCustomerSearch(searchInput));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, dispatch]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('fullName', {
        header: 'Customer',
        cell: (c) => (
          <div className="flex items-center gap-3">
            <Avatar src={c.row.original.profileImage} name={c.getValue()} size={40} />
            <span className="text-[13px] font-semibold text-foreground">{c.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (c) => <span className="text-[13px] text-muted">{c.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: (c) => <span className="text-[13px] text-muted">{c.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('totalOrders', {
        header: 'Orders',
        cell: (c) => <span className="text-[13px] font-medium text-foreground">{c.getValue() ?? 0}</span>,
      }),
      columnHelper.accessor('totalSpent', {
        header: 'Spent',
        cell: (c) => <span className="text-[13px] font-semibold text-foreground">{formatINR(c.getValue() ?? 0)}</span>,
      }),
      columnHelper.accessor('walletBalance', {
        header: 'Wallet',
        cell: (c) => <span className="text-[13px] text-muted">{formatINR(c.getValue() ?? 0)}</span>,
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (c) => <CustomerStatusBadge status={c.getValue()} />,
      }),
      columnHelper.accessor('createdAt', {
        header: 'Joined',
        cell: (c) => (
          <span className="text-[13px] text-muted">
            {c.getValue() ? format(c.getValue().toDate(), 'dd MMM yyyy') : '—'}
          </span>
        ),
      }),
    ],
    [],
  );

  const table = useReactTable({ data: customers, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">Customers</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          {counts.total.toLocaleString('en-IN')} registered · {counts.affiliates.toLocaleString('en-IN')} affiliates
        </p>
      </div>

      {/* Status pills */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active = filters.status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => dispatch(setCustomerStatusFilter(tab.value))}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + export */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="SearchLine" size={16} />
          </span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="w-full rounded-md border border-border-strong bg-surface py-2.5 pl-9 pr-3 text-[14px] outline-none placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={() => dispatch(exportCustomersCSV(filters))}
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
            <Skeleton key={i} height={56} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchCustomers({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="User1Line" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No customers found</h2>
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
                  onClick={() => navigate(`/customers/${row.original.id}`)}
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
                onClick={() => dispatch(fetchCustomers({ filters, cursor: lastVisible }))}
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

export default CustomersPage;
