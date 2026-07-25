# Web Batch 3 (Commerce) — corrections layer

Read this BEFORE `Barakath_Web_Batch3_Prompts.md`. That document's own "two corrections" section
turned out to be wrong on both points, and deeper verification against the actual deployed Cloud
Functions, `firestore.rules` and `@barakath/shared` found several more — this is the highest-stakes
batch (real orders, real money) so every claim below was checked against the live source, not the
spec text, before any code was written. Where this file and the prompt document disagree, this file
wins.

## 1. The prompt doc's own "correction #1" (authOTP) is wrong — ignore it

`functions/src/index.ts` exports three separate deployed callables: `authOTP` (send), `verifyOTP`
(verify + mint a custom token), `resendOTP`. This is not a guess — the website's login flow already
uses exactly this three-function design, deployed and verified end-to-end with a real OTP send in
this session (see [[web-foundation]] §"Website uses a SEPARATE MSG91 OTP widget"). There is no
single merged `authOTP` that does everything. Batch 3 needs nothing from this correction — auth was
already built correctly in Batch 1 (W3).

## 2. The prompt doc's own "correction #2" (banners in `general.banners`) is wrong — ignore it

`banners` IS a real top-level Firestore collection (`firestore.rules` line ~315: `match
/banners/{bannerId}`), with a full admin CRUD feature (`apps/admin/src/features/banners/**`:
create/update/delete/reorder/toggle-active, a product picker) and a `BannerProps` type in
`@barakath/shared` (`linkType`/`linkValue`/`linkProductName`/`linkCategoryName`/`placement`/
`position`, no `attachedProductIds` array). Batch 2 already built `getBanners()` and
`/banner/[bannerId]` against this real collection — do not touch it, do not "refactor" it into an
array read off `general/config`. See [[web-foundation]] for what Batch 2 built.

## 3. There is no `spinRewards` collection — a spin win IS a coupon

`spinWheel` (`functions/src/growth/spinWheel.ts`) does not write to any `spinRewards` collection —
one does not exist. On a win it mints a normal, single-use document directly in `coupons`:
`code: "SPIN-XXXXXX"`, `discountType`/`discountValue`/`minimumOrderAmount`/`maximumDiscount` copied
from the winning slot, `usageLimit: 1`, `perUserLimit: 1`, `createdBy: <the winning user's uid>`,
`description: "Spin reward from <campaign name>"`. It also writes a `spinHistory` record (for the
"X spins left" label) but that collection carries no coupon/discount data of its own.

Consequence for C0/C1: there is no `getSpinRewards(uid)`, no `appliedSpinReward` cart-slice field,
no `applySpinReward`/`removeSpinReward` reducer, no separate "spin reward discount" line in totals,
and no "one coupon + one spin reward stackable" rule — `createPaymentOrder` accepts exactly ONE
`couponCode`, full stop. A spin-won coupon is applied through the exact same `applyCoupon` /
`validateCode` path as any other coupon. The only UI difference worth building: query
`coupons` where `createdBy == <uid>` to identify "coupons this user won by spinning" (regular
admin-authored coupons have an admin's uid in `createdBy`, so this cleanly isolates the set) and
show those under a "From your spins" heading in the coupon list, with a small badge — everything
else about them (apply, remove, discount math) is identical to any other coupon.

## 4. Coupon schema — real fields (`CouponProps`, `packages/shared/src/types/coupon.ts`)

```
code, description, discountType: 'Percentage'|'Fixed', discountValue, minimumOrderAmount,
maximumDiscount, usageLimit, usedCount, perUserLimit, validFrom, validUntil, isActive,
applicableCategories: string[], applicableProducts: string[],
applicationType: 'All'|'Category'|'Product', createdBy, createdByName, keywords, createdAt, updatedAt
```

Corrections against the prompt doc's coupon-engine section:
- **No `FreeShipping` discountType.** Only `Percentage` and `Fixed` exist anywhere in the schema or
  the server's `computeCouponDiscount` (`functions/src/orders/service/coupon.ts`). Do not build a
  free-shipping branch — it would never fire and the server would never honour it anyway.
- **No `targetUsers` field** ("New users" / "Affiliates" targeting does not exist on the document).
  Drop those two eligibility rules entirely — there is nothing to check them against.
- Field names: `minimumOrderAmount` (not `minCartValue`), `applicationType` +
  `applicableCategories`/`applicableProducts` (not a single `categoryRestriction` string),
  `validUntil`/`validFrom` (not `expiryDate`).
- **`coupons` IS readable by any signed-in customer** — `firestore.rules`: `allow read: if
  isSignedIn() || isAdmin()`. The `coupon.ts` service file's own comment ("admin-read-only") is
  stale relative to the deployed rule; trust the rule, not that comment.
- **`coupons/{id}/usageHistory` has NO client read rule at all** — a customer cannot read it, so
  the "already used by this user → hidden" eligibility check from the prompt doc cannot be
  implemented client-side. Drop that specific check from `getEligibleCoupons`/`validateCode` (it's
  optimistic-display-only by design anyway); the server's `perUserLimit` check in
  `computeCouponDiscount` remains the authoritative enforcement and will reject a reused coupon with
  a clear message when the order is actually placed.
- The discount math to mirror exactly (`computeCouponDiscount`): base = the whole subtotal for
  `applicationType: 'All'`, or the sum of only the matching items' subtotals for `Category`/
  `Product` (throws if nothing matches, so treat a non-matching cart as ineligible, not a $0
  discount). `Percentage` → `base * discountValue / 100`, capped at `maximumDiscount` when > 0.
  `Fixed` → `discountValue` flat, capped at `base`. There is no per-item proration beyond that.

## 5. Totals engine — mirror the server exactly, not the spec's tax model

`functions/src/orders/service/computeTotals.ts` is short enough to port near-verbatim. The prompt
doc's totals section is wrong on tax and delivery in ways that would make the client's displayed
total disagree with what the server actually charges — which is exactly what the "reconcile before
opening Razorpay" step exists to catch, so getting this wrong means every single checkout shows a
scary "amount changed" prompt for no reason.

- **No cgst/sgst split.** The server returns one flat `gstAmount`. Do not invent a CGST/SGST
  breakdown — nothing downstream (order doc, payment doc, invoice) has those fields either.
- **`pricesIncludeTax` is NOT consulted by order pricing**, even though `DeliverySettings` (the
  shared settings type) declares the field and the admin Settings screen presumably lets someone
  toggle it. `computeOrderTotals` unconditionally does
  `gstAmount = round2((subtotal - discount) * gstPercentage / 100)`, ADDED on top — never
  extracted/inclusive. This looks like a real, narrow gap in the backend (the toggle exists in
  settings but nothing reads it for order totals) — worth a one-line flag to the user, but the
  client-side totals engine must reproduce the server's ACTUAL behavior (always add GST on top),
  not the spec's inclusive/exclusive branching, or the two will disagree on every order.
- **Delivery**: `standardDeliveryFee` unless subtotal ≥ `freeDeliveryThreshold` (then 0) unless the
  cart has any `isCombo` item, in which case delivery = the LARGEST `comboDeliveryCharge` among the
  combo items present (confirmed — the prompt doc's guess on this one was right). All three fields
  read from `general/config.delivery` (already on `GeneralSettingsProps`, already fetched by
  `getGeneralSettings()` since Batch 1 — no new read needed).
- **Wallet toggle** reads from `general/config.payment.walletPaymentsEnabled` (not `general.
  walletPayments`) — also already on `GeneralSettingsProps`.
- Order of operations, exactly: `subtotal → coupon discount (capped at subtotal) → deliveryCharge →
  gstAmount off (subtotal − discount) → grandTotal = subtotal − discount + delivery + gst →
  walletAmountUsed = min(requested, grandTotal) → razorpayAmount = grandTotal − walletAmountUsed`.
  Round every money value to 2dp with the same "round early, round often" approach the server uses
  (`round2`), or float drift will produce off-by-a-paisa reconciliation prompts.
- Real return shape to match: `{ subtotal, couponDiscount, deliveryCharge, gstAmount, grandTotal,
  walletAmountUsed, razorpayAmount }`. No `spinRewardDiscount`, no `taxableValue`, no `cgst`/`sgst`.

## 6. There is no `walletOnlyOrder` callable — `createPaymentOrder` handles both paths

Read `functions/src/orders/createPaymentOrder.ts` before writing `checkoutThunks.ts` — this is the
single most consequential correction in this batch.

`createPaymentOrder` is the ONE callable for placing an order, wallet-covered or not:
- Request: `{ items: [{productId, variantId, quantity}], addressId, couponCode?, walletAmountToUse? }`
- It resolves every item's real price/stock server-side, applies the coupon, computes totals,
  reserves stock, spends the coupon usage and debits the wallet — **all inside one Firestore
  transaction that also creates the `orders/{orderId}` document itself**, before a Razorpay order is
  even opened. `paymentStatus` is set to `'Paid'` immediately if the wallet covers the whole total,
  or `'Pending'` if a Razorpay leg remains.
- Only if there's still an amount due does it also create a Razorpay order and return a non-null
  `razorpayOrderId`.
- Response: `{ orderId, razorpayOrderId: string | null, amount, key_id }`.

So there is no separate "wallet-only" callable and no separate order-creation step for it — the
**same** `placeOrder(...)` thunk call handles both cases; the only difference is what the response
contains:
- `razorpayOrderId === null` → the order is already fully created and Paid. Skip Razorpay entirely,
  clear the cart, route straight to `/order-success?orderId=<orderId>`. No waiting, no webhook, no
  race, because there is nothing left to confirm.
- `razorpayOrderId` present → the order exists (status `'Pending'`, `paymentStatus: 'Pending'`) but
  is unpaid. Open Razorpay Checkout with `{ razorpayOrderId, key_id, amount }`.

## 7. The payment-confirmation race is real, but not the race the prompt doc describes

The order document is NOT created by the webhook and does NOT "not exist yet" when the Razorpay
callback fires — it already exists (see §6), created synchronously by `createPaymentOrder` before
checkout even opened. The actual race is over which of TWO confirmers flips its `paymentStatus`
field first:

1. **`verifyPayment`** (`functions/src/orders/verifyPayment.ts`, an `onCall`) — meant to be invoked
   by the CLIENT right after Razorpay's browser success callback fires, with
   `{razorpay_order_id, razorpay_payment_id, razorpay_signature}`. It verifies the HMAC itself
   server-side and, if valid, flips the order + payment doc to `'Paid'` **synchronously** and
   returns `{verified: true, orderId}` (or `{verified: false}` on a bad signature — treat that as
   "something is wrong", not as "still processing"). This is the fast path and normally resolves
   before the checkout thunk even needs to look at Firestore.
2. **`razorpayWebhook`** (`functions/src/payments/razorpayWebhook.ts`, an `onRequest`, server-to-
   server from Razorpay) — the authoritative backstop. Handles `payment.captured` (flips to `'Paid'`,
   idempotent no-op if `verifyPayment` already got there first) and `payment.failed` (reverses
   stock/coupon/wallet, flips to `'Failed'`). This is what eventually resolves things if the
   browser tab closes or the network drops between Razorpay's success callback and `verifyPayment`
   completing.

Corrected client flow for C2/C0's checkout thunk:
1. Call `verifyPayment` with the three Razorpay fields from the success callback.
2. `{verified: true, orderId}` → done immediately. Clear cart, route to `/order-success?orderId=`.
3. On a thrown error / network failure (NOT `{verified:false}`, an actual failed call) — fall back
   to subscribing to `orders/{orderId}` via `onSnapshot` (see §8 on why `orders`, not `payments`)
   and wait for `paymentStatus` to leave `'Pending'`. Same "confirming, not failing" UX the prompt
   doc describes, same 60s soft-timeout — just aimed at the right field on the right collection.
4. On the Razorpay failure/dismiss callback (never attempted payment, or explicitly failed in the
   Razorpay sheet) → route to `/payment-failed?orderId=<orderId>` (see §9 — use `orderId`, there is
   no `transactionId`). Do not clear the cart. Note for your build summary, not something to fix in
   this batch: a user who dismisses Checkout without attempting payment leaves that order stuck at
   `paymentStatus: 'Pending'` with stock still reserved — Razorpay never fires a webhook for an
   attempt that never happened. Whether something (e.g. `dailyCleanup`) expires these is a backend
   question outside this batch's scope; flag it, don't try to fix it from the client.

## 8. `payments/{paymentId}` is `allow read: if isAdmin()` — the client cannot read it, ever

This directly breaks the prompt doc's "subscribe to the payment document by transactionId" idea —
that would be a permission-denied `onSnapshot` that silently never fires, which is worse than an
error (it just hangs on the "confirming" screen forever). There is also no `transactionId` field
anywhere in the schema (payment docs are looked up server-side via
`where('orderId', '==', orderId)`, keyed by their own auto-id which the client never needs).

Use `orders/{orderId}` for everything client-facing instead — it IS readable by its owner
(`firestore.rules`: `allow read: if isAdmin() || (isSignedIn() && resource.data.userId ==
request.auth.uid)`), and it already carries every field the UI needs: `paymentStatus`, `status`,
`grandTotal`, `items`, etc. (`OrderProps`, `packages/shared/src/types/order.ts` — already the
correct, complete shape, no changes needed there). Design around `orderId` as the one id that
threads through the whole flow — `createPaymentOrder`'s response already hands it back up front,
before payment even starts, so there's no need to invent a separate transaction identifier at all.

## 9. Order Success / Payment Failed — use `orderId`, not `transactionId`

C3's prompt is written entirely around a `transactionId` query param and a payment-document read.
Correct it to `orderId` throughout: `/order-success?orderId=<id>` (already right in the doc) and
`/payment-failed?orderId=<id>` (doc says `transactionId`). "Read the payment document for a failure
reason" is not possible (§8) — if a reason is worth surfacing, read `orders/{orderId}` and look at
`status`/`paymentStatus`/`cancelReason`, not a payment doc.

## 10. Wishlist storage — it's a subcollection, not an array field

`firestore.rules`: `match /users/{userId}/wishlist/{productId} { allow read, write: if
isOwner(userId); }` — doc id IS the product id, doc body is `{ productId, addedAt }`. This is a
proper subcollection, not "a set of arbitrary productIds on the user document" as C4's prompt
describes. Practically this changes only where C4 gets its id list from: `getDocs(collection(db,
'users', uid, 'wishlist'))` rather than reading an array field off the user doc — the rest of C4's
plan (chunked `documentId() in` product reads, in-memory faceting, the 200-item guard) is unaffected
and still correct.

## 11. Address / cart shape — C0's step 0 instruction stands, unmodified

Nothing found while preparing this batch contradicts C0's plan to read the real address shape out
of `apps/app` before writing `AddressForm`/`AddressPicker` — that instruction is still correct and
still the right way to get it right on the first try. `users/{uid}/addresses` is confirmed to exist
as a subcollection (`firestore.rules`, already noted in [[web-foundation]]); no field table was
found anywhere in this repo outside the Flutter app itself, so reading it there remains the only
source of truth.

## Summary of what actually changes in each prompt

- **C0**: drop `getSpinRewards`/spin-reward cart state entirely (§3); rewrite the coupon engine's
  field names and eligibility rules (§4); rewrite the totals engine to the real 7-field shape with
  no tax-inclusive branching and no cgst/sgst (§5); replace `placeWalletOnlyOrder` +
  `awaitPaymentConfirmation`-against-a-payment-doc with the real `createPaymentOrder` → (maybe)
  `verifyPayment` → (fallback) `orders/{orderId}` onSnapshot flow (§6, §7, §8); everything about
  address components (§6 of the original prompt) and the `/cart` shell is unaffected.
- **C1**: replace the "spin reward banner" with a "From your spins" grouping inside the existing
  coupon list, sourced by `createdBy == uid` (§3); everything else (item list, stock validation,
  coupon input, order summary) is unaffected, just wired to C0's corrected engines.
- **C2**: replace the wallet-only-path and Razorpay-webhook-race sections with §6/§7/§8's real flow;
  everything about address/delivery-method/payment-method UI is unaffected.
- **C3**: `transactionId` → `orderId` throughout; "read the payment document" → "read
  `orders/{orderId}`" (§9).
- **C4**: source the wishlisted id list from the `wishlist` subcollection, not a user-doc array
  (§10); everything else unaffected.
- **C5**: unaffected — proceed as written.

## 12. C0 — address shape + cart persistence audit (§0 of the original prompt), and what got built

Written after actually reading `apps/app/lib/features/address/**` and `apps/app/lib/features/cart/**`
end to end, per this batch's step 0 instruction. Both findings below are load-bearing for C2 (checkout
address UI) and C5 (`/account/addresses`) — read this before building either.

### 12.1 Address shape — one real gap found and fixed

`users/{uid}/addresses/{id}` (`AddressModel` in `apps/app/lib/features/address/data/models/`,
cross-checked against `firestore.rules` and `functions/src/orders/createPaymentOrder.ts`'s own
`shippingAddress` reader):

```
id, label ('Home'|'Office'|'Other', legacy docs missing it read as 'Home'), fullName, phone
  (stored WITH the dial code, e.g. "+91 9502148890"), addressLine1, addressLine2, city, state,
  pincode, landmark, isDefault, createdAt (Timestamp)
```

`packages/shared`'s `UserAddressProps` (`src/types/user.ts`) already existed with every field above
**except `label`** — a real gap, not a naming mismatch: the Flutter entity has carried `label` since
before this repo's shared types were written, and `createPaymentOrder.ts` already reads it
defensively (`String(a.label ?? 'Home')`) for the order's embedded shipping address, so the server
side was already tolerating its absence on old docs. **Fixed**: `label: string` added to
`UserAddressProps` directly (not a new type — the brief's "if @barakath/shared exports an Address
type, use it" applied once this one field was added). Verified this doesn't break `apps/admin`
(`tsc --noEmit` still clean there; the one place admin reads addresses,
`features/customers/components/CustomerAddressesTab.tsx`, casts straight from Firestore data and
never constructs a literal `UserAddressProps`, so an added field is a no-op for it).

Also real, not in the original field list: the manual "set as default" toggle. Spec §2.14's prose says
"first added = default, no toggle", but the shipped Flutter form (`add_address_page.dart`) has always
had a `SwitchListTile` for it. Real code wins — `AddressForm.tsx` keeps the toggle (hidden only for
the very first address, which is forced default regardless of what the toggle says).

`OrderShippingAddress` (the flat shape embedded ON an order) deliberately still has NO `label` field —
`AddressModel.toShippingMap()` never included it either, and `createPaymentOrder.ts` reads it
separately onto the order doc from the raw address doc, not through `toShippingMap`'s shape. Left as-is.

### 12.2 Cart persistence — on-device only, confirmed, no Firestore sync exists

`apps/app/lib/features/cart/data/datasources/cart_local_datasource.dart`'s own header states it
outright: *"The cart lives entirely on-device."* `cart_item.dart`'s entity carries only
`productId, variantId, productName, variantName, variantColor, productImage, quantity` — no price
(re-read live at checkout) — and is persisted as JSON in `SharedPreferences`, keyed by `PrefKeys.cart`.
`cart_remote_datasource.dart` exists but is **read-only against the catalogue** (re-fetches
product/variant docs for pricing/stock refresh) — it has no cart-write method at all. There is no
`users/{uid}/cart` path anywhere in `firestore.rules`, `packages/shared`, or the Flutter datasources.

**Consequence for the website**: no cross-device cart sync is possible even in principle — the product
doesn't have one anywhere, so the website doesn't invent one either. `cartSlice.ts` persists to
`localStorage` (via `redux-persist`, keyed `Constants.STORAGE_KEY_CART = 'barakath.cart'` — that key
already existed in `config/constants.ts` before this session touched it, suggesting whoever scaffolded
Batch 1/2 anticipated exactly this design) for BOTH guests and signed-in customers alike, matching the
app's own guest-and-signed-in-identical behaviour. Signing out does not clear it (`stores/store.ts`'s
sign-out wipe already special-cased the cart to survive before this session started — unchanged here).

### 12.3 What C0 actually built (files, for C1/C2/C5 to import against)

| File | Exports |
|---|---|
| `src/types/cart.ts` | `CartItem`, `AppliedCoupon` — shared shapes (see file header for why NOT inside `features/cart`) |
| `src/features/cart/stores/cartSlice.ts` | `CartState`, actions `addItem/updateQuantity/removeItem/clearCart/applyCoupon/removeCoupon/toggleWallet/selectAddress` |
| `src/lib/commerce/totals.ts` | `computeTotals`, `computeDeliveryCharge`, `computeCouponDiscountPreview`, `round2`, types `ComputeTotalsInput`/`TotalsBreakdown`/`TotalsSettings` |
| `src/lib/commerce/coupons.ts` | `getEligibleCoupons`, `validateCode`, `getSpinWonCoupons`, `getCouponById`, `toAppliedCoupon` |
| `src/lib/commerce/razorpay.ts` | `loadRazorpayScript`, `openCheckout`, `RazorpaySuccessResponse` |
| `src/features/checkout/api/checkoutThunks.ts` | thunks `placeOrder`, `confirmPayment` (+ their arg/result types) |
| `src/features/address/components/{AddressForm,MapPicker,AddressCard,AddressPicker}.tsx` | see component docstrings |
| `src/features/address/api/addresses.ts` | `listAddresses`, `createAddress`, `deleteAddressAndPromote` (direct Firestore writes — self-owned, rule-constrained, no Cloud Function per the trust-boundary skill rule) |
| `src/features/address/hooks/useAddresses.ts` | `useAddresses(uid)` — local (non-Redux) data hook C2/C5 are expected to use |
| `src/app/(checkout)/cart/page.tsx` | the `/cart` shell (breadcrumb + "Secure checkout" + composes `CartSection`/`CheckoutSection`) |

Two path deviations from the original prompt text, both because the real repo already disagreed with
it (trust the real code, per this batch's own rule):
- **Route**: the prompt said `src/app/(shop)/cart/page.tsx`. The real repo already had
  `src/app/(checkout)/cart/page.tsx` scaffolded (a full route group, with its own `layout.tsx` and a
  documented rationale for why cart/order-success/payment-failed/spin-win/wishlist are a group of
  their own, `noindex`, separate from `(shop)`'s indexable catalog). Built at the real path.
- **Thunk location**: the prompt said a flat `src/store/checkoutThunks.ts` / `src/store/cartSlice.ts`.
  This repo's established convention (every other feature already in the repo, and the react-nextjs
  skill) is `features/<feature>/api/` for thunks and `features/<feature>/stores/` for the slice. Built
  at `features/checkout/api/checkoutThunks.ts` (thunks only — C2 owns `features/checkout/stores/
  checkoutSlice.ts`, which is expected to consume these via `extraReducers`) and
  `features/cart/stores/cartSlice.ts` (already existed at that path from earlier scaffolding; rewritten).

One more real find, not anticipated by either the prompt or `WEB_BATCH3_NOTES.md`'s earlier sections:
**`cartSlice.ts` already existed** before this session (created 2026-07-23, before this notes file's
first version) with an `appliedSpinRewardCouponCode` field and `offerPrice`/`productName`/`variantName`
naming — i.e. it was built against the UNCORRECTED prompt. It has been rewritten in place to match §3's
"a spin win is just a coupon" correction and this batch's field names; its one consumer at the time,
`features/product/components/ProductExperience.tsx`'s `onAddToBag`, was updated in the same pass to
match (dispatches `cart/addItem` with the new field names, by raw action-type string — that file
already used this pattern for `cart/addLine` before this session, to avoid a `features/product` →
`features/cart` import the ESLint zones forbid; `checkoutThunks.ts`'s `cart/clearCart` dispatch follows
the same established convention).

### 12.4 Build/test status at handoff

`apps/web`: `npx tsc --noEmit` clean · `npx eslint .` clean · `npm run build` 25/25 pages ·
`npx vitest run` 11/11 passing (`src/lib/commerce/totals.test.ts`). `packages/shared`:
`npx tsc --noEmit` clean. `apps/admin`: `npx tsc --noEmit` has pre-existing, unrelated errors (React
19 + `react-loading-skeleton`/`react-datepicker` JSX-typing incompatibilities across several admin
screens, nothing address- or `label`-related) — confirmed present before this session touched
anything in `apps/admin`, out of this batch's scope to fix.

No live order document was available to this session (no Firestore network access from this
environment) to cross-check `totals.ts`'s output against a real stored order's totals — the brief
flagged this as optional but valuable; flagging here that it was NOT done, and the test suite's
assertions are hand-derived from the same formulas instead (see `totals.test.ts`'s header comment).
