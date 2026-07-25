'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections, OrderStatus, type OrderProps, type ProductProps, type ReplacementProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { fetchReplacementForLine } from '../api/orders';

function itemKey(productId: string, variantId: string): string {
  return `${productId}|${variantId}`;
}

export interface ItemReplacementState {
  loading: boolean;
  /** Whether the LIVE product still offers replacement — a product setting the admin can withdraw;
   *  the order document carries no copy of it, so this always reads the catalogue, never the order. */
  canReplace: (productId: string) => boolean;
  /** The request already raised for this line, if any. */
  replacementFor: (productId: string, variantId: string) => ReplacementProps | null;
}

/**
 * Per-line "can this be returned / already has a request" state for a DELIVERED order (spec 3.11 §2).
 * Mirrors `apps/app/lib/features/orders/presentation/providers/order_detail_provider.dart`'s
 * `_loadItemState` exactly: for each line, read the live product's `replacementAvailable` (deduped per
 * productId — a combo/bundle order can repeat a product across lines) and look up any existing
 * `replacements` doc for that (orderId, productId, variantId) triple.
 *
 * WHY only for Delivered: "Return / Replace" is a post-delivery action — running these extra reads on
 * an in-flight order would be pure waste, same reasoning the Flutter provider documents for itself.
 */
export function useItemReplacementState(order: OrderProps | null, uid: string | null): ItemReplacementState {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const [replacements, setReplacements] = useState<Record<string, ReplacementProps>>({});

  useEffect(() => {
    if (!order || !uid || order.status !== OrderStatus.DELIVERED) {
      setAvailable({});
      setReplacements({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const availableMap: Record<string, boolean> = {};
      const replacementMap: Record<string, ReplacementProps> = {};
      const seenProducts = new Set<string>();

      for (const item of order.items) {
        if (!seenProducts.has(item.productId)) {
          seenProducts.add(item.productId);
          try {
            const snap = await getDoc(doc(db, FirestoreCollections.products, item.productId));
            const product = snap.exists() ? (snap.data() as ProductProps) : null;
            availableMap[item.productId] = Boolean(product?.replacementAvailable);
          } catch {
            availableMap[item.productId] = false;
          }
        }

        try {
          const existing = await fetchReplacementForLine(uid, order.id, item.productId, item.variantId);
          if (existing) replacementMap[itemKey(item.productId, item.variantId)] = existing;
        } catch {
          // A failed lookup must not block rendering — worst case the customer sees the "Return /
          // Replace" link when a request already exists, discovers it on the return page, and goes back.
        }
      }

      if (!cancelled) {
        setAvailable(availableMap);
        setReplacements(replacementMap);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order, uid]);

  return {
    loading,
    canReplace: (productId) => available[productId] ?? false,
    replacementFor: (productId, variantId) => replacements[itemKey(productId, variantId)] ?? null,
  };
}
