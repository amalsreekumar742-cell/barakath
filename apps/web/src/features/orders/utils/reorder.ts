import { doc, getDoc } from 'firebase/firestore';
import { FirestoreCollections, ProductStatus, type OrderProps, type ProductProps, type VariantProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';
import { resolvePrice } from '@/lib/pricing';
import { Constants } from '@/config/constants';
import type { AppDispatch } from '@/stores/store';

/**
 * "Reorder" (spec 3.11): re-add every still-purchasable line of a past order to the bag at TODAY's
 * price, skipping anything the live catalogue no longer stocks. Mirrors
 * `apps/app/lib/features/orders/presentation/providers/orders_provider.dart`'s `buildReorder` exactly —
 * same two-gate check (product `Active`, variant `stock > 0`), same "never carry over the old price"
 * rule (the server re-prices every line at checkout regardless; `resolvePrice` gives the CURRENT price
 * for display), same quantity clamp.
 *
 * WHY this reads Firestore directly rather than going through a `createAsyncThunk`: `features/orders`
 * has no slice consuming this (see the account-hook note in `usePaginatedCollection`'s own header) and
 * a reorder is a one-shot, page-scoped action, not state anything else subscribes to — the same
 * reasoning `useLiveStock` (features/cart) already documents for itself.
 *
 * WHY `dispatch({ type: 'cart/addItem', ... })` as a raw action rather than importing `addItem` from
 * `cartSlice`: `features/orders` may not import `features/cart` (`import/no-restricted-paths`).
 * `createSlice({ name: 'cart', ... })` always produces the stable type string `'cart/addItem'` — the
 * exact escape hatch `features/checkout/api/checkoutThunks.ts` and `features/product/components/
 * ProductExperience.tsx` already use for the same boundary.
 */
export interface ReorderOutcome {
  added: number;
  skipped: number;
}

export async function reorderItems(order: OrderProps, dispatch: AppDispatch): Promise<ReorderOutcome> {
  let added = 0;
  let skipped = 0;

  for (const item of order.items) {
    try {
      const productSnap = await getDoc(doc(db, FirestoreCollections.products, item.productId));
      if (!productSnap.exists()) {
        skipped++;
        continue;
      }
      const product = { ...(productSnap.data() as ProductProps), id: productSnap.id };
      if (product.status !== ProductStatus.ACTIVE) {
        skipped++;
        continue;
      }

      const variantSnap = await getDoc(
        doc(db, FirestoreCollections.products, item.productId, FirestoreCollections.variants, item.variantId),
      );
      if (!variantSnap.exists()) {
        skipped++;
        continue;
      }
      const variant = { ...(variantSnap.data() as VariantProps), id: variantSnap.id };
      if (variant.stock <= 0) {
        skipped++;
        continue;
      }

      const resolved = resolvePrice(product, variant);
      // Never exceed what is actually on the shelf, nor the cart's own per-line cap.
      const quantity = Math.max(1, Math.min(item.quantity, variant.stock, Constants.CART_MAX_QTY));
      const variantDetails = [variant.color, variant.name].filter(Boolean).join(' · ') || variant.name;

      dispatch({
        type: 'cart/addItem',
        payload: {
          productId: product.id,
          variantId: variant.id,
          categoryId: product.categoryId,
          name: product.name,
          variantDetails,
          image: product.thumbnail || product.images[0] || item.productImage || '',
          quantity,
          unitPrice: resolved.displayPrice,
          mrp: resolved.mrp,
          isCombo: Boolean(product.isCombo),
          comboDeliveryCharge: product.isCombo ? product.comboDeliveryCharge : 0,
          stockAtAdd: variant.stock,
        },
      });
      added++;
    } catch {
      // A missing/errored read must fail CLOSED (treated as unavailable), never silently add a stale
      // line — same reasoning `useLiveStock` documents for its own error path.
      skipped++;
    }
  }

  return { added, skipped };
}
