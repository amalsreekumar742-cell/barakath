import { type FC, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { setChartPeriod } from '../stores/dashboardSlice';
import { fetchRevenueChart } from '../api/fetchRevenueChart';
import { formatINR, formatINRCompact } from '@/utils/format';
import type { ChartPeriod } from '../types';

const PERIODS: ChartPeriod[] = ['12M', '30D', '7D'];

/**
 * RevenueChart — revenue-over-time bar chart with a 12M/30D/7D toggle (spec §1.3).
 *
 * WHY dispatch on toggle (not local state): the period lives in the slice and each change dispatches
 * `fetchRevenueChart`, so the server does the per-bucket aggregation and the chart re-renders off slice
 * state (skill: reads go through thunks; UI renders explicit loading/data).
 */
const RevenueChart: FC = () => {
  const dispatch = useAppDispatch();
  const period = useAppSelector((s) => s.dashboard.chartPeriod);
  const { data, loading, error } = useAppSelector((s) => s.dashboard.revenueChart);

  const rows = useMemo(
    () => (data ? data.labels.map((label, i) => ({ label, value: data.data[i] ?? 0 })) : []),
    [data],
  );

  const onPick = (p: ChartPeriod) => {
    if (p === period) return;
    dispatch(setChartPeriod(p));
    void dispatch(fetchRevenueChart(p));
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-foreground">Revenue trend</h2>
        <div className="flex items-center gap-1 rounded-lg bg-subtle p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                p === period ? 'bg-primary text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading || (!data && !error) ? (
        <Skeleton height={240} />
      ) : error ? (
        <div className="flex h-[240px] items-center justify-center text-[14px] text-muted">
          {error}
        </div>
      ) : rows.every((r) => r.value === 0) ? (
        <div className="flex h-[240px] items-center justify-center text-[14px] text-muted">
          No revenue in this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#7f7f7f' }}
            />
            <YAxis
              tickFormatter={(v: number) => formatINRCompact(v)}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 11, fill: '#7f7f7f' }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(15,122,90,0.06)' }}
              formatter={(v: number) => [formatINR(v), 'Revenue']}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #ececec',
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {rows.map((_, i) => (
                <Cell key={i} fill="#0f7a5a" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default RevenueChart;
