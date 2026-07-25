/**
 * Cart / checkout domain types shared across features (`cart`, `checkout`) and shared libs
 * (`lib/commerce/*`). These are website-only client shapes — NOT part of the Firestore contract
 * (that's what `packages/shared`'s `OrderItemProps` etc. are for) — so they live here, not there.
 *
 * WHY here and not inside `features/cart`: `features/checkout` (C2's `checkoutThunks.ts`, and this
 * session's `lib/commerce/{totals,coupons}.ts`) needs the exact same shapes, and a feature may not
 * import another feature (`eslint.config.mjs`'s `import/no-restricted-paths`). Putting the type in
 * `src/types/` — a shared module by the unidirectional-import rule (shared → features → app) — lets
 * both features import it without violating the boundary that keeps five parallel Batch 3 sessions
 * from silently coupling to each other's internals.
 */

/**
 * One bag line. Deliberately carries NO trusted price: `unitPrice`/`mrp` are a display-only preview
 * (re-priced server-side by `createPaymentOrder`, which reads the product/variant docs itself and
 * ignores anything the client sends). `categoryId` is needed even though the brief's own field list
 * omitted it — `computeCouponDiscount`'s `Category`-application-type coupons match on it, and without
 * it a Category coupon's client-side preview could never agree with the server (every checkout would
 * hit the "amount changed" reconciliation prompt for no reason). `stockAtAdd` is the stock snapshot
 * read when the line was added — used only to cap the quantity stepper UI-side; the server re-checks
 * live stock at checkout regardless.
 */
export interface CartItem {
  productId: string;
  variantId: string;
  categoryId: string;
  name: string;
  image: string;
  /** Human-readable variant summary, e.g. "Green · 100ml" — combines whatever axes the product has. */
  variantDetails: string;
  unitPrice: number;
  mrp: number;
  quantity: number;
  isCombo: boolean;
  /** Only meaningful when `isCombo` — replaces (not adds to) the standard delivery fee. */
  comboDeliveryCharge: number;
  stockAtAdd: number;
}

/**
 * A slim, JSON-serialisable projection of `CouponProps` (from `@barakath/shared`) held in cart state.
 * WHY not the full `CouponProps`: that type carries Firestore `Timestamp` fields (`validFrom`,
 * `validUntil`, `createdAt`, `updatedAt`). `cartSlice` is persisted to `localStorage` via
 * `redux-persist`, which JSON-serialises the whole slice — a `Timestamp` class instance would come
 * back from `localStorage` as a plain `{seconds,nanoseconds}` object missing `.toMillis()`, and any
 * code that later calls it would throw. Validity is re-checked live against Firestore every time a
 * coupon is applied/re-applied anyway (`lib/commerce/coupons.ts`), so persisting the date fields buys
 * nothing and only risks a stale/broken value surviving a reload.
 */
export interface AppliedCoupon {
  code: string;
  description: string;
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  maximumDiscount: number;
  applicationType: 'All' | 'Category' | 'Product';
  applicableCategories: string[];
  applicableProducts: string[];
  /** `coupons.createdBy === the signed-in uid` at the moment it was applied — powers the "From your
   *  spins" badge in C1's coupon UI without a second round-trip. */
  isSpinWon: boolean;
}
