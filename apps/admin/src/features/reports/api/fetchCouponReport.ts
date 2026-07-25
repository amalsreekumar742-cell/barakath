import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  Timestamp,
} from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import { OrderStatus } from '@barakath/shared/config/enums';
import type { CouponProps } from '@barakath/shared/types';
import { db } from '@/lib/firebaseConfig';
import type { CouponReportData, TopCoupon } from '../types';

/**
 * fetchCouponReport — total redemptions, total discount given in range, active-coupon count and the
 * most-used coupons (spec §1.19 coupon performance / §1.12 coupons).
 *
 * WHY aggregation + one bounded top-N read: `totalUsed` sums the denormalized `usedCount` across all
 * coupons server-side; `totalDiscount` sums `couponDiscount` over non-cancelled orders in range (orders
 * without a coupon contribute 0, so no coupon-code filter is needed); top coupons is a single ordered
 * limit-10 read. Excluding cancelled orders reuses the orders (status + createdAt) composite index.
 */
export const fetchCouponReport = createAsyncThunk<
  CouponReportData,
  { from: number; to: number },
  { rejectValue: string }
>('reports/fetchCoupon', async ({ from, to }, { rejectWithValue }) => {
  try {
    const coupons = collection(db, FirestoreCollections.coupons);
    const orders = collection(db, FirestoreCollections.orders);
    const fromTs = Timestamp.fromDate(new Date(from));
    const toTs = Timestamp.fromDate(new Date(to));

    const [usedAgg, activeSnap, topSnap, discountAgg] = await Promise.all([
      getAggregateFromServer(query(coupons), { total: sum('usedCount') }),
      getCountFromServer(query(coupons, where('isActive', '==', true))),
      getDocs(query(coupons, orderBy('usedCount', 'desc'), limit(10))),
      getAggregateFromServer(
        query(
          orders,
          where('createdAt', '>=', fromTs),
          where('createdAt', '<=', toTs),
          where('status', '!=', OrderStatus.CANCELLED),
        ),
        { total: sum('couponDiscount') },
      ),
    ]);

    const topCoupons: TopCoupon[] = topSnap.docs
      .map((d) => {
        const c = { ...d.data(), id: d.id } as CouponProps;
        return {
          id: c.id,
          code: c.code,
          usedCount: c.usedCount ?? 0,
          usageLimit: c.usageLimit ?? 0,
          isActive: c.isActive,
        };
      })
      .filter((c) => c.usedCount > 0);

    return {
      totalUsed: usedAgg.data().total ?? 0,
      totalDiscount: discountAgg.data().total ?? 0,
      activeCoupons: activeSnap.data().count,
      topCoupons,
    };
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not load coupon report');
  }
});
