'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import type { CartItem } from '@/types/cart';

/**
 * useLiveStock — re-validates every cart line's stock against the LIVE `products/{id}/variants/{id}`
 * document when the bag mounts (and whenever the set of lines changes), per the C1 brief: `stockAtAdd`
 * on `CartItem` is only a snapshot from whenever the line was added, so a bag built yesterday can
 * silently hold something that has since sold out.
 *
 * WHY a component-local hook doing direct Firestore reads, not a `createAsyncThunk` in a feature
 * `api/` folder (the skill's default pattern): this session's ownership is scoped to
 * `features/cart/components/**` for this parallel batch, and C0 already established the precedent of
 * a plain client-side Firestore hook for exactly this shape of read —
 * `features/product/hooks/useMoreReviews.ts` does the same thing for the same reason (a live
 * client-side re-check that has no server-only equivalent it could call instead).
 *
 * WHY `Promise.all` over N `getDoc`s rather than one batched query: each line's variant lives at a
 * different subcollection parent (`products/{productId}/variants/{variantId}`), so there is no single
 * collection-group query that fetches an arbitrary set of (parent, id) pairs by id alone. A cart is
 * small by nature (a customer's own bag, not a growable list), so N bounded single-doc reads is the
 * honest shape here, not a pagination concern.
 *
 * WHY missing/errored reads resolve to stock 0: a deleted product/variant or a permission/network
 * failure must fail CLOSED (treated as sold out, blocking checkout) rather than fail open and let a
 * customer pay for something that may not exist.
 */

/** Stable identity for a cart line — same convention `cartSlice`'s `sameLine` uses (product + variant). */
export function lineKey(productId: string, variantId: string): string {
  return `${productId}::${variantId}`;
}

export interface LiveStockResult {
  /** Live stock per `lineKey`. A key ABSENT from this map means "not checked yet" — callers must not
   *  treat a missing key as 0; only an explicit 0 means sold out. */
  stockByKey: Record<string, number>;
  /** True while the current item set's stock check is in flight (initial mount or after the set of
   *  (product, variant) pairs in the bag changes — NOT on a plain quantity edit). */
  isChecking: boolean;
}

export function useLiveStock(items: CartItem[]): LiveStockResult {
  const [stockByKey, setStockByKey] = useState<Record<string, number>>({});
  const [isChecking, setIsChecking] = useState(true);

  // Only the SET of (productId, variantId) pairs should trigger a re-fetch — bumping a quantity must
  // not cost a Firestore round trip. Sorted so item re-ordering doesn't spuriously change the signature.
  const keySignature = items
    .map((i) => lineKey(i.productId, i.variantId))
    .sort()
    .join('|');

  useEffect(() => {
    let cancelled = false;

    if (items.length === 0) {
      setStockByKey({});
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    // De-dupe by key: `cartSlice.addItem` merges same-line adds so this shouldn't happen in practice,
    // but guards against a duplicate read if that invariant ever changes.
    const uniqueItems = Array.from(
      new Map(items.map((i) => [lineKey(i.productId, i.variantId), i])).values(),
    );

    Promise.all(
      uniqueItems.map(async (item) => {
        const key = lineKey(item.productId, item.variantId);
        try {
          const snap = await getDoc(
            doc(
              db,
              FirestoreCollections.products,
              item.productId,
              FirestoreCollections.variants,
              item.variantId,
            ),
          );
          const stock = snap.exists() ? ((snap.data().stock as number | undefined) ?? 0) : 0;
          return [key, Math.max(0, stock)] as const;
        } catch {
          return [key, 0] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setStockByKey(Object.fromEntries(entries));
      setIsChecking(false);
    });

    return () => {
      cancelled = true;
    };
    // `items` itself is intentionally not a dependency — only its derived (product, variant) signature
    // should re-trigger the effect; see the WHY above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySignature]);

  return { stockByKey, isChecking };
}
