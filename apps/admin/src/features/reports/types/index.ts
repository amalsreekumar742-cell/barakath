import type { Timestamp } from 'firebase/firestore';

/**
 * Reports & Analytics types (spec §1.19). The reports screen owns seven independent reports, each with
 * its own fetch/data/loading/error, driven by a shared date range + a Sales-only day/week/month grouping.
 *
 * WHY dates are stored as epoch millis (number), not Firestore `Timestamp`, in the slice: Redux state
 * must stay serializable, and a `Timestamp` instance trips RTK's serializable-state check. The thunks
 * convert millis → `Timestamp.fromDate(new Date(ms))` at the query edge (skill: Timestamps at the data
 * edge, plain values in state).
 */

/** The seven report tabs. Also the CSV-export switch key. */
export type ReportKey =
  | 'sales'
  | 'category'
  | 'product'
  | 'customer'
  | 'payment'
  | 'inventory'
  | 'coupon';

/** Sales-report time bucketing (spec §1.19 "Revenue by month" + day/week rollups). */
export type GroupBy = 'day' | 'week' | 'month';

/** Shared date window for every report, as epoch millis (inclusive of both ends at day granularity). */
export interface DateRange {
  from: number;
  to: number;
}

/** Arguments every report thunk receives (Sales also reads `groupBy`). */
export interface ReportArgs {
  from: number;
  to: number;
  groupBy: GroupBy;
}

// --- Sales ------------------------------------------------------------------------

/** One bucket of the sales series (spec §1.19 revenue-by-period). */
export interface SalesPeriod {
  /** NET of GST — tax collected for the government is not the business's revenue. */
  revenue: number;
  label: string;
  /** GST collected in this bucket, i.e. exactly what was deducted from gross to get `revenue`. */
  gstCollected: number;
  orderCount: number;
  /** `revenue / orderCount`, so it is net of GST like the revenue beside it. */
  avgOrderValue: number;
}

export interface SalesReportData {
  periods: SalesPeriod[];
  /** Σ period revenue — net of GST. */
  totalRevenue: number;
  /** Σ GST collected, shown beside the revenue card so the deduction is visible, not silent. */
  totalGst: number;
  totalOrders: number;
  avgOrderValue: number;
  /** Signed % change of this window's revenue vs the immediately preceding equal-length window. */
  revenueTrend: number;
}

// --- Profit -----------------------------------------------------------------------

/**
 * Gross profit over the range: what customers paid for the goods, less what the goods cost.
 *
 * Only orders whose every line has a recorded purchase price can be measured, so the report also
 * reports its own COVERAGE. An order with no cost on file is excluded, never counted at zero cost —
 * that would report the entire sale as profit and quietly inflate the figure.
 */
export interface ProfitReportData {
  /** `revenue − cost` across measurable orders. */
  profit: number;
  /** Selling value of the measured lines (excludes delivery, GST and coupon adjustments). */
  revenue: number;
  /** Purchase payment for the same lines. */
  cost: number;
  /** `profit / revenue × 100`, or 0 when there is no measured revenue. */
  marginPercent: number;
  /** Orders that had a full cost record. */
  measuredOrders: number;
  /** Non-cancelled orders in range, measurable or not. */
  totalOrders: number;
  /** True when the underlying order scan hit its cap, so these are bounded figures. */
  capped: boolean;
}

// --- Category ---------------------------------------------------------------------

export interface CategoryReportItem {
  categoryName: string;
  revenue: number;
  orderCount: number;
  /** Share of total attributed revenue (0–100, rounded). */
  percentage: number;
}

export interface CategoryReportData {
  items: CategoryReportItem[];
  totalRevenue: number;
}

// --- Product ----------------------------------------------------------------------

export interface ProductReportItem {
  productId: string;
  productName: string;
  revenue: number;
  quantity: number;
  orderCount: number;
}

export interface ProductReportData {
  /** Sorted by revenue desc (top N). The bar chart uses the first 10. */
  items: ProductReportItem[];
}

// --- Customer ---------------------------------------------------------------------

export interface TopCustomer {
  id: string;
  fullName: string;
  totalOrders: number;
  totalSpent: number;
}

export interface CustomerReportData {
  newCustomers: number;
  repeatCustomers: number;
  totalCustomers: number;
  topCustomers: TopCustomer[];
}

// --- Payment ----------------------------------------------------------------------

export interface PaymentMethodStat {
  method: string;
  count: number;
  amount: number;
}

export interface PaymentReportData {
  byMethod: PaymentMethodStat[];
  totalRevenue: number;
  refundTotal: number;
  failedCount: number;
  gstCollected: number;
}

// --- Inventory --------------------------------------------------------------------

export interface InventoryLowStockItem {
  productId: string;
  productName: string;
  sku: string;
  totalStock: number;
  stockStatus: string;
}

export interface InventoryReportData {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalProducts: number;
  totalSkus: number;
  /** Approximate catalogue value (Σ totalStock × minPrice). See the thunk's Cloud-Function TODO. */
  estimatedValue: number;
  lowStockItems: InventoryLowStockItem[];
}

// --- Coupon -----------------------------------------------------------------------

export interface TopCoupon {
  id: string;
  code: string;
  usedCount: number;
  usageLimit: number;
  isActive: boolean;
}

export interface CouponReportData {
  totalUsed: number;
  /** Σ couponDiscount over non-cancelled orders in range that carried a coupon. */
  totalDiscount: number;
  activeCoupons: number;
  topCoupons: TopCoupon[];
}

/** Generic per-report async section (skill: explicit loading|error|data, never inferred from null). */
export interface ReportSection<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

/** A trimmed order used by the client-side order-scan reports (category / product). */
export interface ScannedOrder {
  id: string;
  grandTotal: number;
  couponCode: string;
  couponDiscount: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    subtotal: number;
  }[];
  createdAt: Timestamp | null;
}
