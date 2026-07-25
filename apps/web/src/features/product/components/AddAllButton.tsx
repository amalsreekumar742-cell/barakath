'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { toastError, toastSuccess } from '@/lib/toast';
import { useAppDispatch } from '@/stores/store';
import { useRequireAuth } from '@/hooks/useRequireAuth';

/** One frequently-bought-together bundle item, pre-resolved to a display price server-side. */
export interface BundleItem {
  productId: string;
  variantId: string;
  categoryId: string;
  productName: string;
  variantName: string;
  image: string;
  offerPrice: number;
  mrp: number;
  isCombo: boolean;
  comboDeliveryCharge: number;
  stock: number;
  inStock: boolean;
}

/**
 * "Add all" for the frequently-bought-together bundle (spec §3.7, only rendered when
 * `product.isCombo === true`). Dispatches one `cart/addItem` per IN-STOCK item — out-of-stock items are
 * silently excluded from the cart write but named in a toast so the customer knows what didn't make it
 * in, rather than the bundle quietly under-adding with no explanation.
 */
export function AddAllButton({ items }: { items: BundleItem[] }) {
  const dispatch = useAppDispatch();
  const { requireAuth } = useRequireAuth();
  const [adding, setAdding] = useState(false);

  function onAddAll() {
    requireAuth(() => {
      setAdding(true);
      try {
        const inStock = items.filter((i) => i.inStock);
        const skipped = items.filter((i) => !i.inStock);

        // Dispatched by raw action type — `features/product` may not import `features/cart`
        // (`import/no-restricted-paths`). See `ProductExperience.tsx`'s `onAddToBag` for the same
        // pattern; `cartSlice`'s reducer name is `addItem`, so the type is `'cart/addItem'`.
        for (const item of inStock) {
          dispatch({
            type: 'cart/addItem',
            payload: {
              productId: item.productId,
              variantId: item.variantId,
              categoryId: item.categoryId,
              name: item.productName,
              variantDetails: item.variantName,
              image: item.image,
              quantity: 1,
              unitPrice: item.offerPrice,
              mrp: item.mrp,
              isCombo: item.isCombo,
              comboDeliveryCharge: item.comboDeliveryCharge,
              stockAtAdd: item.stock,
            },
          });
        }

        if (inStock.length === 0) {
          toastError(null, 'Everything in this bundle is out of stock right now.');
        } else if (skipped.length > 0) {
          toastSuccess(
            `Added ${inStock.length} item${inStock.length > 1 ? 's' : ''} — skipped ${skipped
              .map((s) => s.productName)
              .join(', ')} (out of stock).`,
          );
        } else {
          toastSuccess('Added the whole bundle to your bag');
        }
      } finally {
        setAdding(false);
      }
    });
  }

  return (
    <Button variant="primary" size="md" loading={adding} onClick={onAddAll}>
      Add all to bag
    </Button>
  );
}
