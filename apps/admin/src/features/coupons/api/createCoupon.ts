import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CouponProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { CouponInput } from '../types';
import { isCouponCodeTaken } from './isCouponCodeTaken';

/**
 * createCoupon — create a new coupon document (spec §1.12 Create Coupon).
 *
 * Two-step: (1) enforce code uniqueness with a single-doc query — reject with a message the form maps to
 * an inline error; (2) write the doc with the code uppercased, `usedCount` seeded to 0, keywords
 * precomputed from code + description (so the list search works), and createdAt/updatedAt stamped by the
 * SERVER clock (skill: use serverTimestamp so the authoritative time is immune to a wrong client clock).
 *
 * WHY return the coupon with a client Timestamp.now() for created/updated: serverTimestamp() resolves to
 * null until the write round-trips, but the slice prepends this object into the list immediately — using
 * Timestamp.now() gives it a sortable, displayable value without a re-fetch. The persisted doc still holds
 * the true server time.
 */
export const createCoupon = createAsyncThunk<
  CouponProps,
  { input: CouponInput; adminId: string; adminName: string },
  { rejectValue: string }
>('coupons/create', async ({ input, adminId, adminName }, { rejectWithValue }) => {
  try {
    const code = input.code.trim().toUpperCase();
    if (await isCouponCodeTaken(code)) return rejectWithValue('Coupon code already exists');

    const keywords = keywordsBuilder(`${code} ${input.description}`);
    const validFrom = Timestamp.fromDate(input.validFrom);
    const validUntil = Timestamp.fromDate(input.validUntil);

    // WHY pre-generate the ref + store `id` in the doc: the customer app reads coupons by their `id`
    // field (redemption), so it must be present IN the document — not only as the Firestore doc key.
    // (Pre-generating the ref lets us write the id in the same single set, no follow-up update.)
    const ref = doc(collection(db, FirestoreCollections.coupons));
    const docData = {
      id: ref.id,
      code,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumOrderAmount: input.minimumOrderAmount,
      maximumDiscount: input.maximumDiscount,
      usageLimit: input.usageLimit,
      usedCount: 0,
      perUserLimit: input.perUserLimit,
      validFrom,
      validUntil,
      isActive: input.isActive,
      applicableCategories: input.applicableCategories,
      applicableProducts: input.applicableProducts,
      applicationType: input.applicationType,
      createdBy: adminId,
      createdByName: adminName,
      keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData);

    // Client-side mirror for optimistic list prepend (server holds the real timestamps).
    const now = Timestamp.now();
    return {
      ...docData,
      createdAt: now,
      updatedAt: now,
    } as CouponProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create coupon');
  }
});
