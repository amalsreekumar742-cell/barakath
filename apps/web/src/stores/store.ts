import { combineReducers, configureStore, type Action } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // localStorage — no-ops safely on the server (no `self`)

import uiReducer from './uiSlice';
import authReducer, { signedOut } from '@/features/auth/stores/authSlice';
import cartReducer from '@/features/cart/stores/cartSlice';
import checkoutReducer from '@/features/checkout/stores/checkoutSlice';
import catalogReducer from '@/features/catalog/stores/catalogSlice';
import wishlistReducer from '@/features/wishlist/stores/wishlistSlice';
import ordersReducer from '@/features/orders/stores/ordersSlice';
import walletReducer from '@/features/wallet/stores/walletSlice';
import affiliateReducer from '@/features/affiliate/stores/affiliateSlice';
import spinnerReducer from '@/features/spinner/stores/spinnerSlice';
import notificationsReducer from '@/features/notifications/stores/notificationsSlice';
import { wishlistMiddleware } from '@/features/wishlist/stores/wishlistMiddleware';
import { Constants } from '@/config/constants';

/**
 * The single Redux Toolkit store for the customer website.
 *
 * WHY the root store imports every feature's slice: with RTK the store IS the composition root, so
 * it is the one shared module allowed to reach into features. Feature slices still may not import
 * one another — that stays forbidden.
 *
 * WHY typed hooks: `useAppSelector`/`useAppDispatch` are typed to this store — never untyped.
 *
 * WHY the CART slice (only) is wrapped in `persistReducer`: `apps/app`'s bag lives entirely on-device
 * (SharedPreferences), never synced to Firestore — confirmed against
 * `cart_local_datasource.dart`/`cart_item_model.dart` while building this batch (Web Batch 3, C0). The
 * website mirrors that: `localStorage`, keyed `Constants.STORAGE_KEY_CART`, not a cross-device sync.
 * Nested here (around just `cartReducer`) rather than a root-level persist config so every OTHER
 * slice's behaviour (including the sign-out wipe below) is completely unaffected — persistence is an
 * implementation detail of the cart slice alone. `isHydrating` is blacklisted: it is a
 * point-in-time loading flag (`cartSlice.ts` flips it on `REHYDRATE`, which fires exactly once per
 * load), not data worth remembering across sessions.
 */
const cartPersistConfig = {
  key: Constants.STORAGE_KEY_CART,
  storage,
  version: 1,
  blacklist: ['isHydrating'],
};

const appReducer = combineReducers({
  ui: uiReducer,
  auth: authReducer,
  cart: persistReducer(cartPersistConfig, cartReducer),
  checkout: checkoutReducer,
  catalog: catalogReducer,
  wishlist: wishlistReducer,
  orders: ordersReducer,
  wallet: walletReducer,
  affiliate: affiliateReducer,
  spinner: spinnerReducer,
  notifications: notificationsReducer,
});

export type RootState = ReturnType<typeof appReducer>;

/**
 * Wipe every slice on sign-out.
 *
 * WHY at the ROOT rather than a `reset` in each slice: signing out must leave nothing behind, and a
 * per-slice reset is one forgotten slice away from showing the previous customer's orders or wallet
 * balance to the next person on a shared computer. Handing each reducer `undefined` makes it rebuild
 * its own initial state, so a slice added later is covered automatically with no edit here.
 *
 * WHY the CART deliberately survives: an anonymous bag is not private information, and emptying
 * someone's basket because their session expired is a lost sale, not a security win.
 */
const rootReducer = (state: RootState | undefined, action: Action): RootState => {
  if (action.type === signedOut.type) {
    return appReducer({ cart: state?.cart } as Partial<RootState> as RootState, action);
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) =>
    getDefault({
      /**
       * WHY the serializable check is NARROWED rather than switched off: Firestore `Timestamp`
       * objects sit on every domain type (`createdAt`, `updatedAt`) and are class instances, which
       * the default check flags on every dispatch. Disabling the check entirely would also stop it
       * catching genuinely unserialisable values — a function, a DOM node, a QueryDocumentSnapshot
       * cursor — which are real bugs. Allowing the one known-good shape keeps the guard useful.
       */
      serializableCheck: {
        // redux-persist's own lifecycle actions (PERSIST/REGISTER in particular) carry function
        // fields in their payload by design — the standard exemption list redux-persist's own docs
        // recommend, kept explicit here rather than relied on implicitly.
        ignoredActions: [FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE],
        isSerializable: (value: unknown) =>
          value === null ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          Object.getPrototypeOf(value) === Object.prototype ||
          // A Firestore Timestamp — matched structurally so this file needs no firebase import.
          (typeof (value as { toMillis?: unknown }).toMillis === 'function' &&
            typeof (value as { seconds?: unknown }).seconds === 'number'),
      },
    })
      // Persists `wishlist/toggleWishlistId` (dispatched by the sitewide `WishlistHeart` component, by
      // raw action type) to `users/{uid}/wishlist/{productId}` and hydrates `wishlist.productIds` on
      // sign-in — see `features/wishlist/stores/wishlistMiddleware.ts` for why this belongs in
      // middleware rather than a thunk.
      .concat(wishlistMiddleware),
});

/**
 * The `redux-persist` persistor — rehydrates the cart slice from `localStorage` on load.
 *
 * WHY no `<PersistGate>` wrapping the app: a gate blocks the WHOLE tree behind rehydration, which
 * would hold up every Server-Component-rendered page (catalog, PDP, …) for a read that only the cart
 * needs. Rehydration is asynchronous but fast (a single `localStorage.getItem`), and `cartSlice`'s own
 * `isHydrating` flag (flipped on `REHYDRATE`, see that file) already gives exactly the screens that
 * read the cart something to check — `<CartSection>`/`<CheckoutSection>` render their own skeleton
 * while `isHydrating` is true instead of the rest of the app waiting on it too. `persistor` is
 * exported regardless in case a later session needs `persistor.purge()` (e.g. a "clear my data" action).
 */
export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Re-exported from the auth slice so composition-root consumers — the shared `useLogout` hook, and
 * anything else that ends a session — can dispatch the global sign-out without importing across the
 * feature boundary `import/no-restricted-paths` forbids. This is not a loophole: `signedOut` is a
 * STORE-level concern (the root reducer above keys its full multi-slice wipe off this exact action),
 * so the store is its natural public surface. Feature UI has no such surface, which is why the
 * header's search mount keeps its own scoped, documented exception instead.
 */
export { signedOut } from '@/features/auth/stores/authSlice';
