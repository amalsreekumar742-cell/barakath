import { createAsyncThunk } from '@reduxjs/toolkit';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { CouponProps } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { CouponInput } from '../types';
import { isCouponCodeTaken } from './isCouponCodeTaken';

/**
 * updateCoupon — edit an existing coupon (spec §1.12 editable after creation).
 *
 * Uniqueness is re-checked ONLY when the code changed, excluding the coupon's own id. Keywords are rebuilt
 * only if the code or description changed (they are the sole searchable fields, so nothing else affects
 * them). `usedCount` is NEVER written here — it is a server-owned redemption counter and the admin edit
 * must not clobber it. updatedAt is stamped server-side.
 *
 * WHY pass the previous coupon in: it lets us diff code/description without a re-read to decide whether to
 * run the uniqueness check and rebuild keywords, keeping the update to a single write.
 */
export const updateCoupon = createAsyncThunk<
  CouponProps,
  { couponId: string; input: CouponInput; previous: CouponProps; adminId: string; adminName: string },
  { rejectValue: string }
>('coupons/update', async ({ couponId, input, previous, adminId, adminName }, { rejectWithValue }) => {
  try {
    const code = input.code.trim().toUpperCase();
    const codeChanged = code !== previous.code;
    const descChanged = input.description !== previous.description;

    if (codeChanged && (await isCouponCodeTaken(code, couponId))) {
      return rejectWithValue('Coupon code already exists');
    }

    const keywords =
      codeChanged || descChanged ? keywordsBuilder(`${code} ${input.description}`) : previous.keywords;
    const validFrom = Timestamp.fromDate(input.validFrom);
    const validUntil = Timestamp.fromDate(input.validUntil);

    const patch = {
      code,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumOrderAmount: input.minimumOrderAmount,
      maximumDiscount: input.maximumDiscount,
      usageLimit: input.usageLimit,
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
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, FirestoreCollections.coupons, couponId), patch);

    // Return the merged coupon (keeping the server-owned usedCount/createdAt from `previous`).
    return {
      ...previous,
      ...patch,
      id: couponId,
      updatedAt: Timestamp.now(),
    } as CouponProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not update coupon');
  }
});
