# PHASE 7 COMPLETE — Website Batch 4 (Account Area) Close-Out

Author: D6 (final sweep session). Verified against live code on 2026-07-24, after D0–D5 all merged.
This document is the final record for Batch 4. It does not restate WEB_BATCH4_NOTES.md's reasoning in
full — read that file for the detailed "why"; this file records final route mapping, deviations, gaps,
and verification results.

---

## 1. Spec Part 3 sections → implementing routes

| Spec section | Feature | Route(s) | Status |
|---|---|---|---|
| 3.10 | Account sidebar | `apps/web/src/app/(account)/layout.tsx` (D0) | Built — wraps every route below |
| 3.11 | My Orders + Order Detail + Track + Replacement + Invoice | `/account/orders`, `/account/orders/[orderId]`, `/account/orders/[orderId]/track`, `/account/orders/[orderId]/return`, `/account/orders/[orderId]/invoice` (D1) | Built |
| 3.12 | Wishlist | `/wishlist` (pre-existing, earlier batch) | Not part of Batch 4, unchanged |
| 3.13 | Wallet | `/account/wallet` (D2) | Built |
| 3.14 | Spin & Win | `/spin-win` — lives in `(checkout)` route group, **not** `(shop)` as the prompt doc assumed (D3) | Built |
| 3.15 | Coupon Wallet | `/account/wallet/coupons`, rendering D0's `CouponWallet` (`variant="embedded"`) | Built |
| 3.16 | Affiliate Wallet + Withdrawal | `/account/affiliate-wallet`, `/account/affiliate-wallet/withdraw` (D4) | Built |
| 3.17 | Saved Addresses | `/account/addresses` (D0/D1 scope) | Built |
| 3.18 | Notifications | `/account/notifications` (D5) | Built |
| 3.19 | Settings + Delete Account | `/account/settings` (D5) | Built |

All 14 files under `apps/web/src/app/(account)/` sit under `(account)/layout.tsx` and pick up the sidebar
automatically via Next.js route-group nesting. `/spin-win` sits under `(checkout)/layout.tsx`, which
supplies its own noindex metadata (see §4).

`ComingSoon` (`apps/web/src/components/ComingSoon.tsx`) still exists as a file but is imported nowhere in
the app — confirmed by grep. The only remaining reference is a stale historical comment in
`apps/web/src/features/coupons/CouponWallet.tsx:50` describing what the route used to render before D0
wired it up; it is prose, not live code. No route in this batch renders a placeholder.

---

## 2. Deviations from spec / from the pasted Batch 4 prompt doc

Pulled from WEB_BATCH4_NOTES.md's 9 sections plus additional discrepancies D1–D5 documented inline in
their own committed code (found by reading it directly, not from chat transcripts):

1. **Referral is copy-only, code-based — no link.** Spec 3.16 says "Referral code + link (Copy + Share)."
   Decision (recorded in WEB_BATCH4_NOTES.md §1): no `?ref=` URL, no middleware capture, no landing page —
   Flutter has none of this either, only a shared invite-text carrying the code. D4's
   `ReferralCodeCard` (`apps/web/src/features/affiliate/components/ReferralCodeCard.tsx`) reads
   `user.affiliateCode` (the only such field — there is no separate `referralCode`) and offers Copy
   (`navigator.clipboard.writeText`) and Share (Web Share API, clipboard-copy fallback). Signup-time
   capture (the "Friend's code" field) was already built in an earlier batch — see §3.

2. **`cancelOrder` is customer-callable, not admin-only**, despite spec 5.2 #5's text ("Verify admin auth
   → …"). Live `functions/src/orders/cancelOrder.ts:35,55` explicitly allows the owning customer
   (`isAdmin || ownsOrder`). D1 wired "Cancel" directly to the callable with no special-casing.

3. **Replacement request ID** is a hash of the web's own Firestore-assigned doc id, not a shared
   sequential counter, and not a bit-for-bit port of Dart's `String.hashCode`. Both clients attempt the
   same `general/config.replacementCounter` transaction first (which always fails permission-denied for a
   real customer today — `firestore.rules` grants that doc admin-write only) and fall back to a
   doc-id-derived hash. This is an *inherited Flutter-side limitation*, not a website defect — Flutter's
   own fallback was never a true uniqueness guarantee either (a 4-digit space, `%10000`). Verified: both
   clients follow the same mint-id → upload-photos → create-doc ordering (required because
   `replacements/{id}` update is admin-only in rules, so create-then-update would strand a photo-less
   request).

4. **Wallet top-up is two dedicated callables** (`createWalletTopUpOrder` / `verifyWalletTopUp`), not
   `createPaymentOrder` + `addWalletMoney` as the pasted doc's D2 §2 assumed — neither of the latter two
   apply to top-ups. D2 built against the real contract.

5. **Spin & Win's entire data model differs from the pasted doc.** Slots are embedded directly on the
   `spinnerCampaigns` document (`SpinnerCampaignProps.slots[]`), not a sub-collection; there is no
   `eligibility` field (the wheel is open to any authenticated user); limiting is lifetime-cap +
   hours-cooldown via the top-level `spinHistory` collection, not a per-day `spinUsage` sub-collection; the
   callable returns `{ resultType, slotLabel, couponCode?, couponDetails? }` with no `offerId`. D3 built
   against the real contract, matching landing-wedge selection to `campaign.slots[].label` by string
   equality (see §5 below for the integrity verification of this).

6. **Withdrawal collection is `affiliateWithdrawals`, not `withdrawalRequests`** as the pasted doc calls it
   throughout D4/D6. `firestore.rules` has no `withdrawalRequests` match block at all. D4 built against
   `affiliateWithdrawals` with the exact rule-required field names `rejectionReason`/`processedBy`.

7. **Delete account mirrors Flutter's `anonymiseAccount` exactly, including its known rules gap** — see
   §6 (Cross-Known-Gaps) below; not a new decision, carried forward from an earlier batch confirmation.

8. **Avatar field is `profileImage`, not `profilePhoto`**, and there is no upload UI on the website
   (matches spec 3.19's own omission — settings only edits name/mobile/WhatsApp/email, not the photo).

---

## 3. Cross-client parity check (item 2 of the sweep) — results

Verified by reading `apps/web` and `apps/app` side by side (not inferred from either side's own comments).

- **Replacement request ID**: MATCH. Same transaction-first/hash-fallback shape, same `#RP-XXXX` display
  format, same `requestId` field name on the shared type, same mint→upload→create ordering. The hash
  algorithm itself differs (web uses a djb2-style hash of the doc id; Flutter uses Dart's `hashCode`), but
  this is explicitly non-load-bearing on both sides — the real key is the Firestore doc id — and is
  documented inline in `apps/web/src/features/orders/utils/requestId.ts`.

- **Address creation**: MATCH. Both clients write the identical field set (`label, fullName, phone,
  addressLine1, addressLine2, city, state, pincode, landmark, isDefault, createdAt`) to
  `users/{uid}/addresses/{id}`, with identical phone-storage convention (`"<countryCode> <number>"`) and
  no `uid` field on the doc (ownership is path-based on both sides). No divergence.

- **Withdrawal request writes to `affiliateWithdrawals`**: **DIVERGENCE FOUND.** Web's
  `apps/web/src/features/affiliate/api/withdrawals.ts` writes two extra persisted fields —
  `processingFee` and `netAmount` — that Flutter's `anonymiseAccount`-adjacent withdrawal writer
  (`affiliate_remote_datasource.dart`'s `toCreateMap()`) does not write at all; Flutter instead treats
  `processingFee` as a UI-only display constant (currently `0`) and never persists it or `netAmount`.
  Both field sets satisfy every constraint `firestore.rules` actually enforces on create (the rule has no
  `hasOnly()` restricting extra fields), so this is not a security issue, but it means a document created
  by one client has fields the other never writes — an admin panel reading `processingFee`/`netAmount` off
  a Flutter-originated withdrawal doc gets `undefined`. **Not fixed unilaterally per this batch's own
  "never patch one side silently" rule — flagged here for a human decision**: either drop the two extra
  fields from web (matching Flutter exactly) or backfill them on the Flutter side, whichever is intended
  as the source of truth. Web's field list otherwise matches the spec's own §4.16 field table, for what
  it's worth, if that's the deciding factor.

- **Account deletion / anonymisation**: MATCH, including reused constants. Step 1's field list
  (`fullName/email/whatsapp/profileImage/fcmToken/keywords/updatedAt`) is identical on both clients. Step
  2 (`status: 'Blocked'`) is best-effort/swallowed on both, for the identical known reason (see §6 below).
  The wishlist bounded-batch clear reuses the *exact same* tuning constants on both clients (batch size
  400, max 10 batches) — `apps/web/src/config/constants.ts`'s `WISHLIST_DELETE_BATCH_SIZE` /
  `WISHLIST_DELETE_MAX_BATCHES` match Flutter's `_wishlistBatchSize`/`_maxWishlistBatches` verbatim.

---

## 4. Client-side financial write audit (item 3) — result: no violations found

Grepped all Firestore write calls (`addDoc`/`setDoc`/`updateDoc`/`.update(`/`.set(`/`writeBatch(`) across
`apps/web/src` against the restricted set: `orders`, `walletBalance`, `affiliateBalance`, `stock`,
`coupons.usedCount`, commission/`affiliateTransactions` amounts.

- The **only** write touching a restricted area is the one permitted exception:
  `apps/web/src/features/affiliate/api/withdrawals.ts:32` — `addDoc` on `affiliateWithdrawals`, which
  never writes `affiliateBalance` itself (admin deducts it on approval, per that file's own comment).
- `general/config.replacementCounter` is incremented client-side inside a transaction
  (`apps/web/src/features/orders/utils/requestId.ts:33`), but this is a display counter guarded by
  admin-only write rules — the transaction fails permission-denied for a real customer and the code
  falls back to a hash (see §3), so it is not a live write path in practice, and it is not a financial
  field regardless.
- All other writes found (`deleteAccount.ts`, `PersonalInfoForm.tsx`, `useAuthFlow.ts`, `addresses.ts`,
  `wishlist.ts`, `bankAccounts.ts`, `replacements.ts`) touch only PII, address, wishlist, bank-detail, or
  replacement-request fields — never `walletBalance`, `affiliateBalance`, `stock`, `coupons.usedCount`, or
  any commission field.

**No violations found.**

---

## 5. Referral capture — confirmed still wired correctly (adjusted scope)

Per the scope cut (WEB_BATCH4_NOTES.md §1), there is no `?ref=` URL/cookie flow to verify — none was ever
supposed to exist. What was verified:

- `apps/web/src/features/auth/components/ProfileStep.tsx:78-84` still has the optional "Friend's code"
  text field (`register('referredBy')`), built in an earlier batch, untouched by Batch 4.
- `apps/web/src/features/auth/hooks/useAuthFlow.ts:182-189`'s `saveProfile` still writes `referredBy`
  onto the new user's doc on signup.
- `functions/src/growth/trackReferralSignup.ts` is confirmed to be an `onDocumentWritten('users/{userId}')`
  Firestore trigger, not an HTTP callable — the plain `referredBy` field write above is sufficient to fire
  it; no client-side call is needed anywhere on the website.
- Self-referral guard confirmed in the trigger: `if (referrerId === after.id) return;` — the resolved
  referrer's uid is compared against the new user's own doc id and the trigger bails out if they match.
- D4's referral card (`ReferralCodeCard.tsx`, rendered from `.../affiliate-wallet/page.tsx:173` as
  `<ReferralCodeCard code={user.affiliateCode} />`) reads the correct field (`affiliateCode` — there is no
  `referralCode` or `isAffiliate` field anywhere in the schema) and has both a working Copy button and a
  Share button (Web Share API with a clipboard-copy fallback for browsers without `navigator.share`).

---

## 6. Spin wheel outcome integrity (item 5)

**Code review — verified sound.** `apps/web/src/features/spinner/components/SpinWinExperience.tsx:118-129`
calls the `spinWheel` callable first, then derives the landing index purely from the server's response:

```js
const action = await dispatch(submitSpin({ campaignId: campaign.id }));
const result = action.payload;
const index = findSlotIndex(campaign.slots, result.slotLabel);
await animateToIndex(index, campaign.slots.length);
```

`submitSpin` does nothing but call the `spinWheel` Cloud Function and return its response verbatim — no
local randomness anywhere in the client. `findSlotIndex` is a pure string match against `slotLabel`
(falling back to wedge 0 only if literally no slot label matches, never to a random pick). The server-side
weighted draw (`Math.random()`) happens exclusively inside `functions/src/growth/spinWheel.ts` before any
response is sent. **No code path exists where a client-side pre-selected outcome could determine what the
user sees as their prize.**

**Live Firestore campaign check — attempted, and completed with a definitive negative result, not a gap.**
`firestore.rules` requires `isSignedIn() || isAdmin()` to read `spinnerCampaigns`. An unauthenticated read
attempt against the collection (using the live `apps/web/.env` Firebase Web SDK config) returned
`permission-denied`, confirming the rule is enforced in production. Without a real authenticated customer
session, it could not be determined whether an active, non-expired `spinnerCampaigns` document currently
exists. **This is stated plainly rather than fabricated** — a human with a real signed-in session (or
direct Firestore console access) should check for an active campaign before relying on `/spin-win` in a
demo or go-live check.

---

## 7. Invoice print stylesheet (item 6)

**Live rendering NOT verified** — Playwright (`@playwright/test`) and an e2e harness exist only under
`apps/admin` (`apps/admin/playwright.config.ts`, `apps/admin/e2e/`), scoped to the admin panel's
email/password login. `apps/web` has no Playwright dependency, no config, and no e2e directory, and the
website's customer auth is OTP-based with no equivalent test-session mechanism available. No browser test
was fabricated.

**Code review of `apps/web/src/app/globals.css:133-165`** (the `@media print` block):

```css
@media print {
  @page { size: A4; margin: 14mm; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; inset: 0; width: 100%; background: #ffffff; color: #000000; }
  .print-hide { display: none !important; }
  .avoid-break { break-inside: avoid; page-break-inside: avoid; }
}
```

- A4 page size: present (`@page { size: A4 }`).
- Chrome hidden: sound approach — everything hidden globally, `.print-area` re-shown, nav/breadcrumb/
  buttons wrapped in `.print-hide` at `page.tsx:121`.
- Black-on-white: **only partially enforced** — `.print-area` sets black-on-white on itself, but several
  descendant elements carry Tailwind theme-variable classes (`text-muted`, `text-faint`, `bg-surface`,
  `border-border`) that are more specific than the inherited color and are not overridden in the print
  block. If those CSS variables resolve to non-black/non-white values, printed text or backgrounds could
  render gray/tinted rather than pure black-on-white.
- Row-break risk: `.avoid-break` is applied once to the whole items container, not per row — for an order
  with many items the container can exceed one page's height, at which point browsers may override
  `break-inside: avoid` and still split a row across a page boundary.

**Recommended manual check before shipping** (a human with a real Delivered order and browser print
preview should confirm): A4 sizing looks correct, no chrome visible, actual rendered text/background is
pure black-on-white (not gray), and an order with many line items does not visibly split a row mid-page.

---

## 8. Notification read-status (item 7) — confirmed localStorage-only

`apps/web/src/features/notifications/utils/readStatus.ts` has no Firestore imports. Grepped for any
Firestore write (`updateDoc`/`setDoc`/`.update(`/`.set(`) touching read/unread/isRead fields anywhere in
the notifications feature — none found. Read state is tracked under a single localStorage key
(`Constants.STORAGE_KEY_READ_NOTIFICATIONS`), read via `getReadIds`/`isRead` and written via
`markRead`/`markAllRead`. **Confirmed: no Firestore write for read-status anywhere.**

---

## 9. SEO surface (item 8)

Two mechanisms are used together:
- `apps/web/src/app/robots.ts` disallows `/account/, /cart, /checkout, /order-success, /payment-failed,
  /login, /api/`.
- Per-layout/per-page `robots: { index: false }` metadata: `(account)/layout.tsx`, `(checkout)/layout.tsx`
  (covers `/cart`, `/order-success`, `/payment-failed`, **and `/spin-win`**, since spin-win lives in this
  group — its route-group placement changed from what the original brief assumed, and its noindex coverage
  moved with it, confirmed correct), `(auth)/layout.tsx` (covers `/login`), plus per-request
  `generateMetadata` on `/search` and `/banner/[bannerId]`.

All required routes — every `(account)/*` route, `/cart`, `/login`, `/search`, `/payment-failed`,
`/order-success`, banner pages, and `/spin-win` — are confirmed noindexed. Nothing on the required list
could not be confirmed.

---

## 10. Verification suite — final run (item 9), verbatim results

Run from a clean state in `apps/web` (pnpm is broken in this environment; ran local `node_modules/.bin`
binaries directly, as every prior Batch 4 session had to):

```
$ rm -rf .next
$ node_modules/.bin/tsc --noEmit
(no output — exit 0)

$ node_modules/.bin/eslint . --max-warnings=0
(no output — exit 0)

$ node_modules/.bin/vitest run
 ✓ src/lib/commerce/totals.test.ts (11 tests) 4ms
 Test Files  1 passed (1)
      Tests  11 passed (11)
(exit 0)

$ node_modules/.bin/next build
 ✓ Compiled successfully in 18.9s
 ✓ Generating static pages (26/26)
Route (app)                                 Size  First Load JS
┌ ○ /                                    10.4 kB         275 kB
├ ○ /account/addresses                   2.17 kB         291 kB
├ ○ /account/affiliate-wallet            5.16 kB         301 kB
├ ○ /account/affiliate-wallet/withdraw    2.9 kB         292 kB
├ ○ /account/notifications                  4 kB         266 kB
├ ○ /account/orders                      4.01 kB         272 kB
├ ƒ /account/orders/[orderId]            4.81 kB         273 kB
├ ƒ /account/orders/[orderId]/invoice     3.7 kB         272 kB
├ ƒ /account/orders/[orderId]/return       25 kB         293 kB
├ ƒ /account/orders/[orderId]/track      4.14 kB         272 kB
├ ○ /account/settings                     4.4 kB         287 kB
├ ○ /account/wallet                      6.54 kB         272 kB
├ ○ /account/wallet/coupons              1.17 kB         271 kB
├ ƒ /api/session                           143 B         103 kB
├ ƒ /banner/[bannerId]                   1.44 kB         266 kB
├ ○ /cart                                6.88 kB         271 kB
├ ○ /categories                            176 B         111 kB
├ ƒ /category/[categoryName]               536 B         271 kB
├ ○ /checkout                            9.21 kB         294 kB
├ ○ /login                               6.07 kB         285 kB
├ ○ /order-success                       3.11 kB         262 kB
├ ○ /payment-failed                      3.67 kB         238 kB
├ ○ /privacy-policy                        167 B         106 kB
├ ƒ /product/[productId]                 7.34 kB         278 kB
├ ○ /robots.txt                            143 B         103 kB
├ ƒ /search                              3.62 kB         268 kB
├ ○ /sitemap.xml                           143 B         103 kB
├ ○ /spin-win                            3.92 kB         274 kB
├ ○ /terms                                 167 B         106 kB
└ ○ /wishlist                             6.2 kB         276 kB
(exit 0)
```

All four commands exited 0. tsc: 0 errors. eslint: 0 errors, 0 warnings. vitest: 11/11 tests passed (C0's
totals engine suite). next build: all routes compiled and generated successfully, including every Batch 4
route.

---

## 11. Spec gaps encountered (pre-existing, not introduced by this batch)

- **Banners are not a Firestore collection** — carried from an earlier batch; banner pages resolve
  products by a `bannerId` tag on products directly, not a `banners` collection with its own document.
- **Related products have no data model** — no `relatedProductIds` or similar field exists on products;
  the product detail page does not attempt a "related products" rail as a result.
- **No coupon-validation callable** — coupon application at checkout re-derives validity client-side from
  the `coupons` doc's own fields (usage limits, expiry, minimum order) rather than calling a server
  function; this predates Batch 4.
- **No `createWithdrawalRequest` callable** — the gap is filled by the one legitimate client-side
  financial write in the project, a direct `affiliateWithdrawals` create, constrained tightly by
  `firestore.rules` (see WEB_BATCH4_NOTES.md §9 and §4 of this doc).
- **`cancelOrder`'s real auth model contradicts spec 5.2's own text** — it is customer-callable for the
  order's owner, not admin-only as the spec table implies (see §2 item 2 above).
- **Addresses have no field table in the spec** — the field set (`label, fullName, phone, addressLine1,
  addressLine2, city, state, pincode, landmark, isDefault`) was reverse-engineered from Flutter's live
  model, confirmed matching on web (§3 above).
- **No review-writing page exists on the website** — reviews are read-only on web; writing a review
  remains an app-only feature. Not in Batch 4's scope, noted as a gap for completeness.
- **`apps/admin`'s pre-existing TS2786 issue** — `apps/admin` tsc --noEmit has pre-existing TS2786
  "cannot be used as a JSX component" / bigint errors across dozens of third-party-component usages
  (`Toaster`, `Outlet`, `NavLink`, `Cropper`, etc.). This is a pre-existing `@types/react`
  version-resolution issue in the shared `node_modules` tree, confirmed NOT caused by this batch — grepped
  the admin error output specifically for `UserProps`/`pendingCommission`/`confirmedCommission`/
  `totalReferrals`/`affiliateEnabled` (the widened `UserProps` type D4 introduced) and found zero matches.
  Out of scope to fix here; noted as a pre-existing gap for a future session.
- **Delete-account `status: 'Blocked'` rules gap, inherited from Flutter** — see §12 below.

---

## 12. Cross-client known gap: delete-account does not actually block sign-in

Confirmed live in `firebase/firestore.rules`'s `onlyOwnProfileFields()` (~line 33-38): the allowlist for
a user's own-profile update is `fullName, email, whatsapp, profileImage, referredBy, keywords, fcmToken,
updatedAt` — **`status` is not in it.** Both Flutter's `anonymiseAccount` and web's mirrored
`deleteAccount.ts` attempt a second, best-effort `{ status: 'Blocked' }` update after the real
anonymisation write, and both swallow the resulting permission-denied error. **This means a "deleted"
account today has its PII wiped but is never actually blocked from signing back in with the same phone
number, on either client.** This is a pre-existing, cross-client limitation inherited from Flutter, not
something Batch 4 introduced or was asked to fix — per WEB_BATCH4_NOTES.md §2's explicit decision, web
mirrors Flutter's behavior exactly (including this gap) rather than unilaterally loosening
`firestore.rules` for one client only, which would make the two clients diverge worse (web blocks, app
doesn't). Fixing this for real requires either an admin-side Cloud Function that verifies email/whatsapp
are already empty before permitting the `status` flip, or an explicit rules-allowlist addition scoped
narrowly enough not to open `status` to arbitrary client tampering — a decision for a human, not a
default-behavior change to make silently in a sweep session.

---

## 13. Deferred: the referral link

The referral **link** (cookie-capture middleware, a `?ref=` query-param handler, and a dedicated landing
page) was scoped out of this batch entirely (WEB_BATCH4_NOTES.md §1) because Flutter, the reference
client, has no equivalent mechanism at all — only a shared invite-text carrying the plain referral code,
and a manual "Friend's code" field at signup. Building a link-based flow for web only would be a new
capability neither client currently has, not a parity fix. **Revisit trigger**: if the product decides
web should support a shareable referral URL (e.g., for social/paid-acquisition use cases where a raw code
converts worse than a link), that would need: a `src/middleware.ts` cookie-capture step, a
`src/features/account/referral.ts` (or similar) helper pair (`getReferralCode`/`clearReferralCode`), and
wiring the captured cookie value into `ProfileStep`'s existing `referredBy` field as a pre-fill/override —
at which point Flutter would also need a corresponding deep-link handler to stay at parity, since today
this fundamentally does not exist on either client.

---

## 14. Divergence requiring a human decision (repeated from §3 for visibility)

**`affiliateWithdrawals` writes**: web persists `processingFee`/`netAmount`, Flutter does not. Both are
individually rules-valid. This was found, not fixed, per this batch's "never silently patch one side"
convention — see §3 for full detail. Needs a product/eng decision on which client is the source of truth
before either side is changed.
