import type { Middleware } from '@reduxjs/toolkit';
import { addWishlistDoc, listWishlistIds, removeWishlistDoc } from '../api/wishlist';
import { setWishlistError, setWishlistIds, setWishlistPending, toggleWishlistId } from './wishlistSlice';
import { toastError } from '@/lib/toast';

/**
 * wishlistMiddleware — turns the sitewide, Firebase-free `wishlist/toggleWishlistId` action (dispatched
 * by `WishlistHeart` on every product card, by raw action type — see that component's header comment)
 * into the actual `users/{uid}/wishlist/{productId}` write, and hydrates `productIds` once per sign-in
 * so a heart drawn on ANY page (not just the wishlist page) shows the right filled state from the start.
 *
 * WHY a middleware rather than a listener component mounted somewhere in the tree: `WishlistHeart`
 * fires a plain action object, not a thunk — a `createAsyncThunk` is the more common pattern for "user
 * action → Firestore write" elsewhere in this codebase (`checkoutThunks.ts`), but it requires the
 * DISPATCHER to know it's dispatching an async operation, and `WishlistHeart` deliberately doesn't (it
 * dispatches a bare, importable-by-string action so it never has to import a thunk from this feature —
 * the whole point of the raw-action-type pattern its own comment documents). A middleware is the one
 * place that can react to that exact action type regardless of where it was dispatched from, without
 * `WishlistHeart` — or any other future caller of the same action — needing to know this file exists.
 *
 * WHY hydration also lives here (reacting to `auth/setAuthResolved`) rather than only in the wishlist
 * page: nothing else in the app populates `wishlist.productIds` on a cold load or fresh sign-in — the
 * slice starts empty and only the wishlist page's own fetch (or a toggle) would ever set it, so every
 * OTHER heart sitewide would show unfilled for a customer who has never opened `/wishlist` this session.
 * Piggybacking on the auth-resolved action (which every session already dispatches exactly once per
 * sign-in) closes that gap without touching `AuthListener` or `providers.tsx`, neither of which this
 * feature owns. The wishlist page still does its OWN id fetch on mount (see `WishlistSection.tsx`) for
 * a guaranteed-fresh read when the page that actually needs it is open; this hydration is a sitewide,
 * best-effort head start, not the page's source of truth — dispatching the same ids twice is harmless.
 *
 * Minimal local state shape (rather than importing `RootState` from `stores/store.ts`): that file is
 * what REGISTERS this middleware, so importing its `RootState` back here would be a circular import.
 */
interface WishlistMiddlewareState {
  auth: { uid: string | null };
  wishlist: { productIds: string[] };
}

const AUTH_RESOLVED = 'auth/setAuthResolved';

export const wishlistMiddleware: Middleware<object, WishlistMiddlewareState> = (store) => (next) => (action) => {
  const result = next(action);

  if (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    (action as { type: unknown }).type === AUTH_RESOLVED
  ) {
    const uid = store.getState().auth.uid;
    if (uid) {
      listWishlistIds(uid)
        .then((ids) => store.dispatch(setWishlistIds(ids)))
        .catch(() => {
          // Best-effort sitewide hydration — a failure here just leaves hearts unfilled until the
          // wishlist page's own fetch succeeds. Not worth surfacing a toast for a background read.
        });
    }
    return result;
  }

  if (toggleWishlistId.match(action)) {
    const productId = action.payload;
    const state = store.getState();
    const uid = state.auth.uid;
    // A guest never reaches here — `WishlistHeart` redirects to /login instead of dispatching — but a
    // signed-out edge case (session expiring mid-click) must not attempt an owner-scoped write with no
    // owner.
    if (!uid) return result;

    // Read membership AFTER the reducer ran (`next(action)` above already applied the optimistic
    // flip), so this reflects the NEW, post-toggle state — exactly what needs to be persisted.
    const isNowWishlisted = state.wishlist.productIds.includes(productId);

    store.dispatch(setWishlistPending({ id: productId, pending: true }));
    const write = isNowWishlisted ? addWishlistDoc(uid, productId) : removeWishlistDoc(uid, productId);
    write
      .then(() => {
        store.dispatch(setWishlistError(null));
      })
      .catch((error: unknown) => {
        // Roll back the optimistic flip and tell the customer — the heart returns to its prior state.
        store.dispatch(toggleWishlistId(productId));
        store.dispatch(setWishlistError('Could not update your wishlist.'));
        toastError(error, 'Could not update your wishlist. Please try again.');
      })
      .finally(() => {
        store.dispatch(setWishlistPending({ id: productId, pending: false }));
      });
  }

  return result;
};
