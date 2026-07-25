import { Timestamp } from 'firebase/firestore';

/**
 * CouponProps — the shape of a coupon document in the `coupons` collection (admin Feature 12 / spec §1.12).
 * WHY in packages/shared: the coupon contract is consumed by BOTH the admin panel (CRUD) and the
 * customer app (redemption at checkout), so it is defined once here and imported by both — never
 * duplicated per app (skill: shared domain types live in packages/shared).
 * WHY Timestamp (not number) for date fields: preserves server-clock precision and sorts/range-queries
 * correctly server-side (skill: date/time fields are Firestore Timestamps).
 */
export interface CouponProps {
  id: string;
  code: string;
  description: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  validFrom: Timestamp;
  validUntil: Timestamp;
  isActive: boolean;
  applicableCategories: string[];
  applicableProducts: string[];
  applicationType: 'All' | 'Category' | 'Product';
  createdBy: string;
  createdByName: string;
  keywords: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
