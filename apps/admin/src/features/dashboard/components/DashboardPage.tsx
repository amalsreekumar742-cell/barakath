import { type FC, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { formatLongDate } from '@/utils/format';
import { fetchDashboardStats } from '../api/fetchDashboardStats';
import { fetchRevenueChart } from '../api/fetchRevenueChart';
import { fetchCategoryPerformance } from '../api/fetchCategoryPerformance';
import { fetchRecentOrders } from '../api/fetchRecentOrders';
import { fetchLowStockProducts } from '../api/fetchLowStockProducts';
import SummaryCards from './SummaryCards';
import RevenueChart from './RevenueChart';
import CategoryPerformance from './CategoryPerformance';
import RecentOrders from './RecentOrders';
import LowStockAlerts from './LowStockAlerts';

/**
 * DashboardPage — live operations overview (spec §1.3).
 *
 * WHY dispatch all five fetches on mount: each panel owns its own loading/error state, so they load
 * independently and in parallel; the revenue chart uses the current `chartPeriod`. Re-runs only if the
 * dispatch identity changes (once).
 */
const DashboardPage: FC = () => {
  const dispatch = useAppDispatch();
  const period = useAppSelector((s) => s.dashboard.chartPeriod);

  useEffect(() => {
    void dispatch(fetchDashboardStats());
    void dispatch(fetchRevenueChart(period));
    void dispatch(fetchCategoryPerformance());
    void dispatch(fetchRecentOrders());
    void dispatch(fetchLowStockProducts());
    // Intentionally run once on mount; the chart refetches itself on period toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-muted">{formatLongDate(new Date())} · Live overview</p>
      </div>

      <SummaryCards />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <CategoryPerformance />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentOrders />
        <LowStockAlerts />
      </div>
    </div>
  );
};

export default DashboardPage;
