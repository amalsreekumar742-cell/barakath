'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, type DocumentSnapshot } from 'firebase/firestore';
import { FirestoreCollections, type ProductProps, type VariantProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { resolvePrice } from '@/lib/pricing';
import { useAppDispatch } from '@/stores/store';
import type { CartItem } from '@/types/cart';
import { syncLiveLines, type LiveLinePatch } from '../stores/cartSlice';

/**
 * useLiveStock — re-validates every cart line against the LIVE `products/{id}` and
 * `products/{id}/variants/{id}` documents when the bag mounts (and whenever the set of lines changes),
 * per the C1 brief: `stockAtAdd` on `CartItem` is only a snapshot from whenever the line was added, so
 * a bag built yesterday can silently hold something that has since sold out.
 *
 * WHY it also refreshes price, MRP and the variant label (`syncLiveLines`), not just stock: the admin
 * edits a variant IN PLACE — price, MRP, stock, even its colour/Size/Layer — and the variant keeps its
 * id, so the bag line still resolves but quotes add-time figures. `createPaymentOrder` re-prices from
 * the live docs regardless, so a stale `unitPrice` put the "amount changed" prompt on every checkout
 * attempt, and a stale label named a size the customer is no longer buying. The price goes through
 * `resolvePrice` — the same rule the PDP used when the line was added — so a refreshed line and a
 * freshly-added one can never disagree. Lines with SOME stock left but less than the quantity are
 * trimmed down to it (see `syncLiveLines`) so checkout doesn't fail with "Only N left".
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
 * honest shape here, not a pagination concern. The product doc is read once per PRODUCT (two sizes of
 * the same perfume share it) — it carries the flash-sale flag the price depends on.
 *
 * WHY missing/errored reads resolve to stock 0 with NO patch: a deleted product/variant or a
 * permission/network failure must fail CLOSED (treated as sold out, blocking checkout) rather than
 * fail open and let a customer pay for something that may not exist — and with nothing read, there is
 * nothing trustworthy to overwrite the snapshot with.
 */

/** Stable identity for a cart line — same convention `cartSlice`'s `sameLine` uses (product + variant). */
export function lineKey(productId: string, variantId: string): string {
  return `${productId}::${variantId}`;
}

export interface LiveStockResult {
  /** Live stock per `lineKey`. A key ABSENT from this map means "not checked yet" — callers must not
   *  treat a missing key as 0; only an explicit 0 means sold out. */
  stockByKey: Record<string, number>;
  /** True while the current item set's check is in flight (initial mount or after the set of
   *  (product, variant) pairs in the bag changes — NOT on a plain quantity edit). Lines may still carry
   *  add-time prices until this flips false, so a caller about to take money should wait for it. */
  isChecking: boolean;
}

/** One line's read result: its live stock, plus the refreshed fields when both docs were read. */
interface LineCheck {
  key: string;
  stock: number;
  patch: LiveLinePatch | null;
}

/** Build a line's patch from the live docs. Field coercion mirrors `createPaymentOrder`'s own
 *  (`Number(x) || 0`), so a malformed field reads the same here as the server will charge it. */
function toPatch(item: CartItem, product: Partial<ProductProps>, variant: Partial<VariantProps>): LiveLinePatch {
  const stock = Math.max(0, Number(variant.stock) || 0);
  const { displayPrice, mrp } = resolvePrice(
    { isFlashSale: product.isFlashSale === true },
    {
      offerPrice: Number(variant.offerPrice) || 0,
      mrp: Number(variant.mrp) || 0,
      flashSalePrice: typeof variant.flashSalePrice === 'number' ? variant.flashSalePrice : undefined,
    },
  );
  const name = String(variant.name ?? '');
  // Same label formula `ProductExperience.onAddToBag` and `reorderItems` write at add time.
  const variantDetails = [String(variant.color ?? ''), name].filter(Boolean).join(' · ') || name;
  return {
    productId: item.productId,
    variantId: item.variantId,
    stock,
    unitPrice: displayPrice,
    mrp,
    variantDetails,
    categoryId: String(product.categoryId ?? ''),
    isCombo: product.isCombo === true,
    comboDeliveryCharge: product.isCombo === true ? Number(product.comboDeliveryCharge) || 0 : 0,
  };
}

export function useLiveStock(items: CartItem[]): LiveStockResult {
  const dispatch = useAppDispatch();
  const [stockByKey, setStockByKey] = useState<Record<string, number>>({});
  const [isChecking, setIsChecking] = useState(true);

  // Only the SET of (productId, variantId) pairs should trigger a re-fetch — bumping a quantity must
  // not cost a Firestore round trip. Sorted so item re-ordering doesn't spuriously change the signature.
  // The refresh this hook dispatches rewrites prices/labels/quantities but never a line's identity, so
  // it cannot re-trigger itself.
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

    const productReads = new Map<string, Promise<DocumentSnapshot>>();
    const readProduct = (productId: string) => {
      let read = productReads.get(productId);
      if (!read) {
        read = getDoc(doc(db, FirestoreCollections.products, productId));
        productReads.set(productId, read);
      }
      return read;
    };

    Promise.all(
      uniqueItems.map(async (item): Promise<LineCheck> => {
        const key = lineKey(item.productId, item.variantId);
        try {
          const [productSnap, variantSnap] = await Promise.all([
            readProduct(item.productId),
            getDoc(
              doc(
                db,
                FirestoreCollections.products,
                item.productId,
                FirestoreCollections.variants,
                item.variantId,
              ),
            ),
          ]);
          if (!productSnap.exists() || !variantSnap.exists()) return { key, stock: 0, patch: null };
          const patch = toPatch(
            item,
            productSnap.data() as Partial<ProductProps>,
            variantSnap.data() as Partial<VariantProps>,
          );
          return { key, stock: patch.stock, patch };
        } catch {
          return { key, stock: 0, patch: null };
        }
      }),
    ).then((checks) => {
      if (cancelled) return;
      const patches = checks.flatMap((c) => (c.patch ? [c.patch] : []));
      // Dispatched BEFORE the local state flips: React batches both, so the bag never paints the
      // "checked" state with the old prices still in it.
      if (patches.length > 0) dispatch(syncLiveLines(patches));
      setStockByKey(Object.fromEntries(checks.map((c) => [c.key, c.stock])));
      setIsChecking(false);
    });

    return () => {
      cancelled = true;
    };
    // `items` itself is intentionally not a dependency — only its derived (product, variant) signature
    // should re-trigger the effect; see the WHY above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySignature, dispatch]);

  return { stockByKey, isChecking };
}
