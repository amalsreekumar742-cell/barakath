import type { OrderProps } from '@barakath/shared/types';

/** Chart period toggle for the revenue chart (spec §1.3). */
export type ChartPeriod = '7D' | '30D' | '12M';

/** KPI summary tiles (spec §1.3 summary cards). Trends are signed percentages vs the prior period. */
export interface DashboardStats {
  todayRevenue: number;
  revenueTrend: number; // vs yesterday
  totalOrdersWeek: number;
  ordersTrend: number; // vs last week
  pendingOrders: number;
  avgOrderValue: number;
  avgTrend: number; // vs last month
}

/** Revenue bar-chart series. */
export interface RevenueChartData {
  labels: string[];
  data: number[];
}

/** One category's share of revenue for the horizontal performance bars. */
export interface CategoryPerformanceItem {
  categoryName: string;
  value: number;
  percentage: number;
}

/** A low/out-of-stock product row (spec §1.3 low-stock alerts). */
export interface LowStockItem {
  productName: string;
  sku: string;
  totalStock: number;
  lowStockThreshold: number;
}

/** Trimmed order shape the Recent Orders table needs. */
export type RecentOrder = Pick<OrderProps, 'id' | 'userName' | 'status' | 'grandTotal' | 'createdAt'>;
