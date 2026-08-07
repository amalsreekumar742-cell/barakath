import { type FC, type ReactNode, useEffect, useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Skeleton from 'react-loading-skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchSalesReport } from '../api/fetchSalesReport';
import { fetchProfitReport } from '../api/fetchProfitReport';
import { fetchCustomerReport } from '../api/fetchCustomerReport';
import { fetchProductReport } from '../api/fetchProductReport';
import { fetchPaymentReport } from '../api/fetchPaymentReport';
import { exportReport } from '../api/exportReport';
import { setDateRange } from '../stores/reportsSlice';
import type { DateRange } from '../types';
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_TICK } from '../utils/chartColors';
import { TrendPill } from './ReportKit';
import DateRangeDialog from './DateRangeDialog';

/** Compact Indian-currency label for KPI/tiles — ₹X Cr / ₹X L / ₹X K (design shows "₹2.84 Cr", "₹4.2L"). */
function compactINR(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return formatINR(n);
}

/**
 * ReportsPage — Reports & Analytics overview (spec §1.19 / prototype "Insights › Reports"): four KPI cards
 * (revenue / orders / new customers / refund rate), a "Revenue by month" bar chart, and a "Top products"
 * list, over a shared date window. The header's "Date range" button opens the range dialog; "Export Excel"
 * opens the same dialog to choose the window, then downloads the report for it.
 */
const ReportsPage: FC = () => {
  const dispatch = useAppDispatch();
  const { dateRange, groupBy, sales, profit, customer, product, payment, exportLoading } =
    useAppSelector((s) => s.reports);
  const [dialog, setDialog] = useState<'none' | 'range' | 'export'>('none');

  // Load every overview section for the current window (sales grouped monthly for the bar chart).
  const refetch = useCallback(() => {
    const { from, to } = dateRange;
    void dispatch(fetchSalesReport({ from, to, groupBy }));
    void dispatch(fetchProfitReport({ from, to, groupBy }));
    void dispatch(fetchCustomerReport({ from, to }));
    void dispatch(fetchProductReport({ from, to }));
    void dispatch(fetchPaymentReport({ from, to }));
  }, [dispatch, dateRange, groupBy]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const applyRange = (range: DateRange) => {
    dispatch(setDateRange(range));
    setDialog('none');
  };

  // Export flow: set the chosen window, refetch sales for it, then download — so the file matches the range.
  const runExport = async (range: DateRange) => {
    dispatch(setDateRange(range));
    await dispatch(fetchSalesReport({ from: range.from, to: range.to, groupBy }));
    const res = await dispatch(exportReport());
    if (exportReport.fulfilled.match(res)) toast.success(`Exported ${res.payload} rows`);
    else toast.error((res.payload as string) ?? 'Export failed');
    setDialog('none');
  };

  const s = sales.data;
  const p = profit.data;

  /**
   * Profit can only be measured for orders with a purchase price on file. Saying so on the card is
   * the difference between "you made ₹X" and "you made ₹X on the orders we can measure" — and every
   * order placed before purchase payment existed falls in the second bucket.
   */
  const profitNote = useMemo(() => {
    if (!p) return undefined;
    if (p.totalOrders === 0) return undefined;
    if (p.measuredOrders === 0) return 'No purchase prices recorded yet';
    if (p.measuredOrders < p.totalOrders)
      return `${p.marginPercent.toFixed(1)}% margin · ${p.measuredOrders} of ${p.totalOrders} orders costed`;
    return `${p.marginPercent.toFixed(1)}% margin on ${compactINR(p.revenue)}`;
  }, [p]);

  const refundRate = useMemo(() => {
    if (!payment.data || !s || s.totalRevenue <= 0) return 0;
    return (payment.data.refundTotal / s.totalRevenue) * 100;
  }, [payment.data, s]);

  const chartData = useMemo(
    () => (s?.periods ?? []).map((p) => ({ label: p.label, revenue: Math.round(p.revenue) })),
    [s],
  );
  const topProducts = product.data?.items.slice(0, 5) ?? [];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Reports &amp; Analytics</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {format(dateRange.from, 'd MMM')} – {format(dateRange.to, 'd MMM yyyy')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDialog('export')}
            disabled={exportLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exportLoading ? (
              <Icon name="Loader4Line" size={16} className="animate-spin" />
            ) : (
              <Icon name="ArrowDownLine" size={16} />
            )}
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => setDialog('range')}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="Filter2Line" size={16} /> Date range
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Revenue (excl. GST)"
          value={compactINR(s?.totalRevenue ?? 0)}
          trend={s?.revenueTrend}
          loading={sales.loading}
          error={sales.error}
          onRetry={refetch}
          // The deduction is stated, not silent — otherwise this figure looks like a wrong total.
          note={s && s.totalGst > 0 ? `${compactINR(s.totalGst)} GST excluded` : undefined}
        />
        <KpiCard
          label="Gross profit"
          value={compactINR(p?.profit ?? 0)}
          loading={profit.loading}
          error={profit.error}
          onRetry={refetch}
          note={profitNote}
        />
        <KpiCard
          label="Orders"
          value={(s?.totalOrders ?? 0).toLocaleString('en-IN')}
          loading={sales.loading}
          error={sales.error}
          onRetry={refetch}
        />
        <KpiCard
          label="New customers"
          value={(customer.data?.newCustomers ?? 0).toLocaleString('en-IN')}
          loading={customer.loading}
          error={customer.error}
          onRetry={refetch}
        />
        {/* Refund rate divides the payment report's refund total by the sales report's revenue, so
            EITHER failing makes the percentage meaningless — surface whichever broke. */}
        <KpiCard
          label="Refund rate"
          value={`${refundRate.toFixed(1)}%`}
          loading={payment.loading || sales.loading}
          error={payment.error ?? sales.error}
          onRetry={refetch}
        />
      </div>

      {/* Revenue by month + Top products */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Revenue by month">
          {sales.loading ? (
            <Skeleton height={200} borderRadius={8} />
          ) : sales.error ? (
            /* Checked BEFORE the empty case: a failed query also yields an empty `periods`, and
               "No revenue in this range" is a factual claim about the business, not about the query. */
            <SectionError message={sales.error} onRetry={refetch} />
          ) : chartData.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-muted">No revenue in this range</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececec" />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => compactINR(Number(v))} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatINR(Number(v)), 'Revenue']} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top products">
          {product.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} height={34} borderRadius={8} />
              ))}
            </div>
          ) : product.error ? (
            <SectionError message={product.error} onRetry={refetch} />
          ) : topProducts.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">No product sales in this range</p>
          ) : (
            <div>
              {topProducts.map((p, i) => (
                <div
                  key={p.productId}
                  className="flex items-center gap-3 border-b border-border py-2.5 last:border-0"
                >
                  <span className="w-4 text-[12px] font-extrabold text-faint">{i + 1}</span>
                  <span className="flex-1 truncate text-[13px] font-semibold text-foreground">{p.productName}</span>
                  <span className="text-[13px] font-extrabold text-gold-strong">{compactINR(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Date-range chooser (Apply) */}
      <DateRangeDialog
        isOpen={dialog === 'range'}
        onClose={() => setDialog('none')}
        initialRange={dateRange}
        title="Select date range"
        confirmLabel="Apply"
        onConfirm={applyRange}
      />
      {/* Export chooser — pick the window, then download the Excel/CSV for it */}
      <DateRangeDialog
        isOpen={dialog === 'export'}
        onClose={() => setDialog('none')}
        initialRange={dateRange}
        title="Export to Excel"
        confirmLabel="Export Excel"
        confirmLoading={exportLoading}
        onConfirm={runExport}
      />
    </div>
  );
};

/**
 * KPI tile matching the prototype: label + 24px value + optional signed trend, plus an optional
 * `note` for a figure that needs qualifying (what was deducted, what the coverage is). A number that
 * silently excludes something is worse than one that says what it excluded.
 */
/**
 * One KPI figure.
 *
 * WHY `error` is not optional-and-ignored: when a report query fails, its `data` is null and every
 * numeric read falls back to 0 — so the card rendered a confident "₹0" / "0" that was indistinguishable
 * from a genuine zero. That is exactly how a missing composite index presented on 2026-08-04: Revenue
 * and Orders showed ₹0 while Gross profit beside them said "1 of 16 orders costed", and the figures had
 * to be caught by eye. A failed query and an empty range are different claims and must not look alike.
 */
const KpiCard: FC<{
  label: string;
  value: string;
  trend?: number;
  note?: string;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}> = ({ label, value, trend, note, loading, error, onRetry }) => (
  <div
    className={`rounded-xl border bg-surface p-4 shadow-sm ${
      error && !loading ? 'border-error/40' : 'border-border'
    }`}
  >
    <p className="text-[12px] font-medium text-faint">{label}</p>
    {loading ? (
      <Skeleton height={28} width={100} className="mt-2" />
    ) : error ? (
      <>
        <p className="mt-2 flex items-center gap-1.5 text-[15px] font-bold leading-none text-error">
          <Icon name="AlertLine" size={16} />
          Couldn&apos;t load
        </p>
        {/* The raw reason, not a friendly euphemism — an admin needs to know it was a failed query, and
            a FAILED_PRECONDITION message names the index that is missing. */}
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted" title={error}>
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 text-[11px] font-semibold text-primary hover:underline"
          >
            Retry
          </button>
        )}
      </>
    ) : (
      <>
        <p className="mt-2 text-[24px] font-extrabold leading-none tracking-tight text-foreground">{value}</p>
        {typeof trend === 'number' && (
          <div className="mt-2">
            <TrendPill value={trend} />
          </div>
        )}
        {note && <p className="mt-2 text-[11px] leading-snug text-faint">{note}</p>}
      </>
    )}
  </div>
);

/**
 * The in-card failure state for a chart or list — the counterpart to KpiCard's error branch.
 *
 * Shows the query's own message rather than generic copy: on this page the realistic failure is a
 * missing Firestore composite index, and that error text names the index (and links to create it).
 * Hiding it behind "Something went wrong" would throw away the only useful part.
 */
const SectionError: FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="py-10 text-center">
    <p className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-error">
      <Icon name="AlertLine" size={16} />
      Couldn&apos;t load this section
    </p>
    <p className="mx-auto mt-1.5 max-w-md break-words text-[11px] leading-snug text-muted">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-3 rounded-md border border-border-strong px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-subtle"
    >
      Retry
    </button>
  </div>
);

/** A titled surface card (design: rounded-xl hairline). */
const Card: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    <h2 className="mb-4 text-[15px] font-bold text-foreground">{title}</h2>
    {children}
  </div>
);

export default ReportsPage;
