import { createAsyncThunk } from '@reduxjs/toolkit';
import { collection, doc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared/config/collections';
import type { FlashSaleProps, FlashSaleProduct } from '@barakath/shared/types';
import keywordsBuilder from '@barakath/shared/utils/keywordsBuilder';
import { db } from '@/lib/firebaseConfig';
import type { FlashSaleInput } from '../types';
import { productsInActiveFlashSale } from './searchFlashSaleProducts';

/**
 * createFlashSale — create a flash-sale campaign applying one discount to a SET of products (spec §1.16
 * Add Flash Sale).
 *
 * Steps:
 * 1. Duplicate guard — reject if ANY selected product is already in an active flash sale still running
 *    (spec §1.16: "same product cannot be in multiple active flash sales").
 * 2. writeBatch: (a) the flash-sale doc with `id` in the doc, the `products` price snapshot, `productIds`
 *    for the array-contains lookup, keywords from the name + every product name, server timestamps;
 *    (b) each product `isFlashSale: true`; (c) each variant `flashSalePrice`.
 *
 * The form computes each variant's flash price from `discountType`/`discountValue`, so no variant re-read
 * is needed here.
 *
 * // TODO: Flash sale activation/deactivation handled by Cloud Scheduler (flashSaleManager) — sets
 * // isFlashSale and variant prices at startDate/endDate.
 */
export const createFlashSale = createAsyncThunk<
  FlashSaleProps,
  { input: FlashSaleInput; adminId: string; adminName: string },
  { rejectValue: string }
>('flashSale/create', async ({ input, adminId, adminName }, { rejectWithValue }) => {
  try {
    const productIds = input.products.map((p) => p.productId);

    // 1. Duplicate guard — any selected product already in a running active sale blocks creation.
    const conflicts = await productsInActiveFlashSale(productIds);
    if (conflicts.size > 0) {
      const names = input.products.filter((p) => conflicts.has(p.productId)).map((p) => p.productName);
      return rejectWithValue(
        `Already in an active flash sale: ${names.join(', ')}. A product can only be in one active flash sale.`,
      );
    }

    const products: FlashSaleProduct[] = input.products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      productImage: p.productImage,
      categoryName: p.categoryName,
      variantPrices: p.variantPrices.map((v) => ({ ...v })),
    }));

    const keywords = keywordsBuilder(`${input.name} ${products.map((p) => p.productName).join(' ')}`);
    const startDate = Timestamp.fromDate(input.startDate);
    const endDate = Timestamp.fromDate(input.endDate);

    // 2. Batched write: flash-sale doc + each product flag + per-variant flash price (spec §1.16 rules).
    const batch = writeBatch(db);
    const ref = doc(collection(db, FirestoreCollections.flashSales));
    const docData = {
      id: ref.id,
      name: input.name,
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      products,
      productIds,
      startDate,
      endDate,
      isActive: input.isActive,
      createdBy: adminId,
      createdByName: adminName,
      keywords,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(ref, docData);

    for (const p of products) {
      batch.update(doc(db, FirestoreCollections.products, p.productId), { isFlashSale: true });
      for (const v of p.variantPrices) {
        batch.update(
          doc(db, FirestoreCollections.products, p.productId, FirestoreCollections.variants, v.variantId),
          { flashSalePrice: v.flashSalePrice },
        );
      }
    }

    await batch.commit();

    // Client-side mirror for the optimistic list prepend (server holds the real timestamps).
    const now = Timestamp.now();
    return { ...docData, createdAt: now, updatedAt: now } as FlashSaleProps;
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : 'Could not create flash sale');
  }
});
