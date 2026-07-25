import {
  getFirestore,
  FieldValue,
  type Transaction,
  type DocumentReference,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Collections } from '../../config/collections';

/**
 * Stock reservation / restoration, split into a READ phase and a WRITE phase so callers can satisfy the
 * Firestore transaction rule (all reads before all writes) even when stock is one of several concerns
 * mutated in the same transaction. WHY transactions: stock must only ever decrement when it is actually
 * available — a read-modify-write races under concurrent checkouts and oversells (skill: value-dependent
 * writes use runTransaction). `totalStock`/`stockStatus` are re-derived from the variant docs (spec §1.6).
 */

/** Mirrors the shared StockStatus enum values (functions can't import the workspace package). */
const StockStatusValue = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
} as const;

/** 0 → Out of stock, ≤ threshold → Low stock, else In stock (spec §1.6, mirrors admin utils/stock.ts). */
export function deriveStockStatus(totalStock: number, lowStockThreshold: number): string {
  if (totalStock <= 0) return StockStatusValue.OUT_OF_STOCK;
  if (totalStock <= lowStockThreshold) return StockStatusValue.LOW_STOCK;
  return StockStatusValue.IN_STOCK;
}

/** A quantity to move for one product+variant (positive quantity; direction decides the sign). */
export interface StockLine {
  productId: string;
  variantId: string;
  quantity: number;
}

interface VariantStock {
  ref: DocumentReference;
  stock: number;
}

interface ProductStock {
  productRef: DocumentReference;
  lowStockThreshold: number;
  variants: Map<string, VariantStock>;
}

/** READ phase: load each product + all its variant docs inside the transaction. */
export async function readProductStock(
  tx: Transaction,
  productIds: string[],
): Promise<Map<string, ProductStock>> {
  const db = getFirestore();
  const result = new Map<string, ProductStock>();
  for (const productId of productIds) {
    if (result.has(productId)) continue;
    const productRef = db.collection(Collections.products).doc(productId);
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists) {
      throw new HttpsError('not-found', `Product ${productId} no longer exists`);
    }
    const pdata = productSnap.data() ?? {};
    const variantsSnap = await tx.get(productRef.collection(Collections.variants));
    const variants = new Map<string, VariantStock>();
    variantsSnap.forEach((d) => {
      const s = (d.data() as { stock?: unknown }).stock;
      variants.set(d.id, { ref: d.ref, stock: typeof s === 'number' ? s : Number(s) || 0 });
    });
    result.set(productId, {
      productRef,
      lowStockThreshold: Number((pdata as { lowStockThreshold?: unknown }).lowStockThreshold) || 0,
      variants,
    });
  }
  return result;
}

/**
 * WRITE phase: apply the stock deltas.
 * - `direction: 'reserve'` decrements and THROWS if any variant would go negative (final oversell guard).
 * - `direction: 'restore'` increments (payment failure / cancellation).
 * After adjusting variants, each affected product's `totalStock`/`stockStatus` are recomputed from the
 * (now-updated) variant map so the denormalized product fields stay correct.
 */
export function writeStockDelta(
  tx: Transaction,
  stockMap: Map<string, ProductStock>,
  lines: StockLine[],
  direction: 'reserve' | 'restore',
): void {
  const sign = direction === 'reserve' ? -1 : 1;

  // Aggregate quantities per product+variant so duplicate lines for the same variant net correctly.
  const perProduct = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const byVariant = perProduct.get(line.productId) ?? new Map<string, number>();
    byVariant.set(line.variantId, (byVariant.get(line.variantId) ?? 0) + line.quantity);
    perProduct.set(line.productId, byVariant);
  }

  for (const [productId, byVariant] of perProduct) {
    const product = stockMap.get(productId);
    if (!product) throw new HttpsError('not-found', `Product ${productId} was not loaded`);

    for (const [variantId, qty] of byVariant) {
      const variant = product.variants.get(variantId);
      if (!variant) {
        throw new HttpsError('not-found', `Variant ${variantId} no longer exists`);
      }
      const newStock = variant.stock + sign * qty;
      if (direction === 'reserve' && newStock < 0) {
        throw new HttpsError(
          'failed-precondition',
          `Insufficient stock for variant ${variantId} (have ${variant.stock}, need ${qty})`,
        );
      }
      variant.stock = newStock; // keep the map in sync for the total recompute below
      tx.update(variant.ref, { stock: newStock });
    }

    let totalStock = 0;
    for (const v of product.variants.values()) totalStock += v.stock;
    tx.update(product.productRef, {
      totalStock,
      stockStatus: deriveStockStatus(totalStock, product.lowStockThreshold),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}
