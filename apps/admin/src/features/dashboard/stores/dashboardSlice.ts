import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { fetchDashboardStats } from '../api/fetchDashboardStats';
import { fetchRevenueChart } from '../api/fetchRevenueChart';
import { fetchCategoryPerformance } from '../api/fetchCategoryPerformance';
import { fetchRecentOrders } from '../api/fetchRecentOrders';
import { fetchLowStockProducts } from '../api/fetchLowStockProducts';
import type {
  ChartPeriod,
  DashboardStats,
  RevenueChartData,
  CategoryPerformanceItem,
  LowStockItem,
  RecentOrder,
} from '../types';

/**
 * dashboardSlice — owns the five independent dashboard fetches (spec §1.3).
 *
 * WHY one loading/error flag per section (not a single global one): each panel loads and fails
 * independently, so each shows its own skeleton / retry (skill: explicit named loading|error|data,
 * never inferred from null). `chartPeriod` drives the revenue-chart toggle.
 */
interface Section<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface DashboardState {
  stats: Section<DashboardStats | null>;
  revenueChart: Section<RevenueChartData | null>;
  categoryPerformance: Section<CategoryPerformanceItem[]>;
  recentOrders: Section<RecentOrder[]>;
  lowStockAlerts: Section<LowStockItem[]>;
  chartPeriod: ChartPeriod;
}

const section = <T>(data: T): Section<T> => ({ data, loading: false, error: null });

const initialState: DashboardState = {
  stats: section(null),
  revenueChart: section(null),
  categoryPerformance: section([]),
  recentOrders: section([]),
  lowStockAlerts: section([]),
  chartPeriod: '12M',
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setChartPeriod(state, action: PayloadAction<ChartPeriod>) {
      state.chartPeriod = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // --- stats ---
      .addCase(fetchDashboardStats.pending, (s) => {
        s.stats.loading = true;
        s.stats.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (s, a) => {
        s.stats.loading = false;
        s.stats.data = a.payload;
      })
      .addCase(fetchDashboardStats.rejected, (s, a) => {
        s.stats.loading = false;
        s.stats.error = a.payload ?? 'Failed to load stats';
      })
      // --- revenue chart ---
      .addCase(fetchRevenueChart.pending, (s) => {
        s.revenueChart.loading = true;
        s.revenueChart.error = null;
      })
      .addCase(fetchRevenueChart.fulfilled, (s, a) => {
        s.revenueChart.loading = false;
        s.revenueChart.data = a.payload;
      })
      .addCase(fetchRevenueChart.rejected, (s, a) => {
        s.revenueChart.loading = false;
        s.revenueChart.error = a.payload ?? 'Failed to load revenue chart';
      })
      // --- category performance ---
      .addCase(fetchCategoryPerformance.pending, (s) => {
        s.categoryPerformance.loading = true;
        s.categoryPerformance.error = null;
      })
      .addCase(fetchCategoryPerformance.fulfilled, (s, a) => {
        s.categoryPerformance.loading = false;
        s.categoryPerformance.data = a.payload;
      })
      .addCase(fetchCategoryPerformance.rejected, (s, a) => {
        s.categoryPerformance.loading = false;
        s.categoryPerformance.error = a.payload ?? 'Failed to load category performance';
      })
      // --- recent orders ---
      .addCase(fetchRecentOrders.pending, (s) => {
        s.recentOrders.loading = true;
        s.recentOrders.error = null;
      })
      .addCase(fetchRecentOrders.fulfilled, (s, a) => {
        s.recentOrders.loading = false;
        s.recentOrders.data = a.payload;
      })
      .addCase(fetchRecentOrders.rejected, (s, a) => {
        s.recentOrders.loading = false;
        s.recentOrders.error = a.payload ?? 'Failed to load recent orders';
      })
      // --- low stock ---
      .addCase(fetchLowStockProducts.pending, (s) => {
        s.lowStockAlerts.loading = true;
        s.lowStockAlerts.error = null;
      })
      .addCase(fetchLowStockProducts.fulfilled, (s, a) => {
        s.lowStockAlerts.loading = false;
        s.lowStockAlerts.data = a.payload;
      })
      .addCase(fetchLowStockProducts.rejected, (s, a) => {
        s.lowStockAlerts.loading = false;
        s.lowStockAlerts.error = a.payload ?? 'Failed to load low-stock alerts';
      });
  },
});

export const { setChartPeriod } = dashboardSlice.actions;
export default dashboardSlice.reducer;
