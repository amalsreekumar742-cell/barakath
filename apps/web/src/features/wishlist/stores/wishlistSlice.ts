import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ProductProps } from '@barakath/shared';

/**
 * The customer's wishlist.
 *
 * WHY `productIds` is a Set-like array held separately from `items`: every product card on every
 * page asks "is this wishlisted?" to draw its heart. That has to be an O(1) lookup against a small
 * list of ids, not a scan of fully-hydrated products — and the ids are known long before the
 * products they point at have been fetched.
 *
 * WHY `pendingIds` exists: the heart toggles optimistically so the tap feels instant, but the write
 * can fail. Tracking which ids are mid-flight lets the card show its own spinner and lets a failed
 * toggle roll back just that heart rather than re-fetching the whole list.
 */
export interface WishlistState {
  productIds: string[];
  /** Hydrated products, loaded only when the wishlist PAGE is open. */
  items: ProductProps[];
  loading: boolean;
  /** Ids whose add/remove is currently in flight. */
  pendingIds: string[];
  error: string | null;
}

const initialState: WishlistState = {
  productIds: [],
  items: [],
  loading: false,
  pendingIds: [],
  error: null,
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    setWishlistIds(state, action: PayloadAction<string[]>) {
      state.productIds = action.payload;
    },
    setWishlistItems(state, action: PayloadAction<ProductProps[]>) {
      state.items = action.payload;
    },
    setWishlistLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    /** Optimistic flip. Reverted by dispatching again if the write rejects. */
    toggleWishlistId(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.productIds = state.productIds.includes(id)
        ? state.productIds.filter((p) => p !== id)
        : [...state.productIds, id];
    },
    setWishlistPending(state, action: PayloadAction<{ id: string; pending: boolean }>) {
      const { id, pending } = action.payload;
      state.pendingIds = pending
        ? [...new Set([...state.pendingIds, id])]
        : state.pendingIds.filter((p) => p !== id);
    },
    setWishlistError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setWishlistIds,
  setWishlistItems,
  setWishlistLoading,
  toggleWishlistId,
  setWishlistPending,
  setWishlistError,
} = wishlistSlice.actions;

export default wishlistSlice.reducer;
