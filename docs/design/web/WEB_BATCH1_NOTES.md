# Website Batch 1 — Foundation Notes

Written by W0. **W1–W4 read this first.** It records which design file is authoritative,
what `@barakath/shared` already gives you, the design tokens, and — most importantly —
the places where the Batch 1 prompt document disagrees with the live system. Where they
disagree, the live system wins and this file says so.

---

## 1. Design file inventory

`docs/design/web/` holds **four** files, which are **two design families × two export formats**.

| File | Modified | Headings | What it is |
|---|---|---|---|
| `Barakath Website.dc.html` | 16 Jul 15:57 | 31 | Older family, readable export |
| `Barakath Website (standalone).html` | 23 Jul 11:02 | — | Same family, self-contained export (3.0 MB) |
| **`Barakath Website Prototype.dc.html`** | **23 Jul 11:02** | **45** | **AUTHORITATIVE** — readable export |
| `Barakath Website Prototype (standalone).html` | 23 Jul 11:02 | — | Same family, self-contained export (3.1 MB) |

**Authoritative: `Barakath Website Prototype.dc.html`.** Two reasons, both checked rather than assumed:

1. **It is newer** — 23 Jul vs 16 Jul for the other family's readable export.
2. **It is a strict superset.** Its heading set contains every heading in `Barakath Website.dc.html`
   plus 14 more. Nothing in the older family is missing from it, so there is no screen you would
   lose by ignoring the older file — which means there is no genuine conflict to resolve, only
   extra coverage.

Screens the Prototype family adds over the older one:

- Product detail is fully expanded: **Description**, **Specifications**, **Frequently bought together**, **Ratings & reviews**
- **Payment failed**, **Page not found (404)**, **Thank you**
- **Privacy policy**, **Terms & conditions**, **Help & contact**
- **Delete your account?**, **No connection**
- **Give ₹100, get ₹100** (referral), **Feeling lucky today?** (spin entry point on home)

The `(standalone).html` pair are the same designs serialised with their design-system bundle
inlined — same content, ~10× the bytes, not separate designs. Read the `.dc.html`; only open a
standalone file if you need an asset the readable export references but does not embed.

> The `.dc.html` files render through `_ds/ecom-barakath-…/` assets that are **not** committed.
> The token CSS is mirrored at `docs/design/design-system/tokens/` and is what §3 below is built from.

**Naming drift:** the project context doc refers to `Barakath_Website_Prototype_dc.html` (underscores).
That file no longer exists — it is now `Barakath Website Prototype.dc.html` (spaces). Every path in
`docs/design/web/` contains spaces; quote them.

---

## 2. What the Batch 1 prompt document gets wrong

These were verified against the live Firestore database, `packages/shared`, the deployed Cloud
Functions and the shipped Flutter app. **Follow this section, not the prompt document.**

### 2.1 Collection names — the prompt has them backwards

The prompt's "Decisions carried over" says top-level collections are `replacementRequests`,
`withdrawalRequests`, `spinRewards`, "not the context doc's `replacements` / `affiliateWithdrawals` /
`affiliateTransactions`."

**That is inverted.** The live database contains exactly `replacements`, `affiliateWithdrawals`
and `affiliateTransactions`. There is no `replacementRequests`, `withdrawalRequests` or
`spinRewards` collection. `packages/shared/config/collections.ts`, the Cloud Functions and the
Flutter app all use the real names. Following the prompt would query empty collections and
silently render empty screens — the worst kind of failure, because nothing errors.

**Always import `FirestoreCollections` from `@barakath/shared`. Never type a collection name.**

### 2.2 `walletTransactions` is top-level, not a subcollection

The prompt says `walletTransactions`, `commissionTransactions` and `bankAccounts` live under
`users/{uid}`. In the live schema:

| Prompt says | Reality |
|---|---|
| `users/{uid}/walletTransactions` | **top-level `walletTransactions`**, filtered `where('userId','==',uid)` |
| `users/{uid}/commissionTransactions` | **top-level `affiliateTransactions`** (no such collection as `commissionTransactions`) |
| `users/{uid}/bankAccounts` | ✅ correct — a subcollection (`firestore.rules:137`) |
| `users/{uid}/addresses` | ✅ correct — this one **is** a subcollection |

`firestore.rules` grants a wallet read on `resource.data.userId == request.auth.uid`, and the
composite index `(userId ASC, createdAt DESC)` exists for the ledger query.

### 2.3 The customer collection is `users` ✅

This one the prompt has right. Profile photos are at Storage path `users/{uid}/profile`.

### 2.4 The complete authoritative collection list

Cross-checked three ways — the deployed `firestore.rules` (26 declared paths), `functions/src/config/
collections.ts`, and `apps/app/lib/core/constants/firebase_collections.dart`. **These are the only
collections that exist. The website must not introduce a 27th.**

| Top-level | Subcollections |
|---|---|
| `users` · `products` · `categories` · `orders` · `payments` · `coupons` · `reviews` · `replacements` · `banners` · `flashSales` · `notifications` · `spinnerCampaigns` · `spinHistory` · `walletTransactions` · `walletTopUps` · `affiliateTransactions` · `affiliateWithdrawals` · `stockAdjustments` · `subAdmins` · `general` · `variables` | `categories/{id}/subCategories` · `products/{id}/variants` · `users/{uid}/addresses` · `users/{uid}/wishlist` · `users/{uid}/bankAccounts` |

Notes that matter when writing a query:

- **`users/{uid}/wishlist/{productId}` — the document id IS the product id.** "Is this wishlisted"
  is a doc read, not a query, and toggling is a `setDoc`/`deleteDoc` at a known path.
- **`walletTopUps` is server-written only.** `firestore.rules:164` is `allow write: if false`, because
  its `amount` is the figure the verifier credits. Owner read is permitted.
- **`variants` has no top-level collection** — only `products/{id}/variants`, plus a collection-group
  rule. A top-level `variables` collection exists and is a *different thing* (colour swatches and
  variant groups for the admin's product form); do not confuse the two.
- **`otpRequests` exists but no rule grants access to it.** `authOTP` parks the MSG91 request id there
  through the Admin SDK. It is unreachable from any client by design — never query it.

W0 added `wishlist`, `bankAccounts` and `walletTopUps` to `FirestoreCollections`, which was missing
all three, plus a `FirestoreDocs` map for the singleton document ids (`general/config`,
`general/secrets`, `variables/config`). **Import both from `@barakath/shared`; never type a
collection or document name as a string literal.**

---

## 3. Design tokens

Ported verbatim into `apps/web/src/app/globals.css` as Tailwind v4 `@theme` tokens, byte-identical
to `apps/admin/src/index.css`. Source: `docs/design/design-system/tokens/`.

| Group | Tokens |
|---|---|
| Brand green | `primary #0f7a5a`, `primary-dark #166534`, `primary-subtle #e9f4ef` |
| Gold | `gold #daa227`, `gold-strong #b8881f` (prices), `gold-subtle #fbf4dd`, `gold-border #e8d28a` |
| Surfaces | `app #fcfcfb`, `surface #ffffff`, `subtle #f8f8f8`, `ink #181717` |
| Text | `foreground #1f1f1f`, `muted #7f7f7f`, `faint #9ea2ad` |
| Borders | `border #ececec`, `border-strong #e5e5e5` |
| Status | `success #16a34a`, `warning #b8881f`, `error #fb3748`, `info #005aa5` (+ `-subtle` each) |
| Type | Manrope for both `--font-sans` and `--font-display` |
| Radius | `xs 4 · sm 6 · md 8 · lg 12 · xl 16` — controls 8, cards 16 |
| Shadow | `xs/sm/md/lg`, warm-tinted `rgba(95,74,46,·)` — never harsh black |
| Breakpoints | `md 768`, `lg 1024` — spec 3.24: desktop ≥1024, tablet 768–1023, mobile <768 |

Use the utilities (`bg-primary`, `text-gold-strong`, `border-border`). **Never inline a hex value.**

---

## 4. What `@barakath/shared` already exports

The admin panel is complete, so nearly everything is already there. **Batch 1 adds no new types.**

- **`FirestoreCollections`** — every collection name, including the `variants` and `subCategories`
  subcollection keys.
- **Types** (all `XxxProps`, dates typed as Firestore `Timestamp`): `ProductProps`, `VariantProps`,
  `SpecificationProps`, `CategoryProps`, `SubCategoryProps`, `OrderProps`, `OrderItemProps`,
  `OrderShippingAddress`, `OrderStatusTimelineEntry`, `UserProps`, `UserAddressProps`,
  `WalletTransactionProps`, `AffiliateTransactionProps`, `AffiliateWithdrawalProps`, `PaymentProps`,
  `ReplacementProps`, `ReviewProps`, `CouponProps`, `SpinnerCampaignProps`, `SpinnerSlotProps`,
  `SpinHistoryProps`, `BannerProps`, `FlashSaleProps`, `NotificationProps`, `GeneralSettingsProps`
  (+ its `DeliverySettings` / `PaymentSettings` / `ContactUsSettings` members), `StockAdjustmentProps`,
  `SubAdminProps`, `AffiliateProductCommission`.
- **Enums**: `OrderStatus`, `PaymentMethod`, `PaymentStatus`, `ProductStatus`, `StockStatus`,
  `UserStatus`, `WalletTransactionType`, `WalletSource`, `ReplacementStatus`, `DiscountType`,
  `CouponApplicationType`, `BannerLinkType`, `BannerPlacement`, `AffiliateWithdrawalStatus`,
  `AffiliateTransactionSource`, `NotificationType`, `ReviewFilter`.
- **`keywordsBuilder`** — the canonical search-keyword generator. Search queries must match the
  array it produces; do not invent a second scheme.

**If you find yourself writing `interface ProductProps` in `apps/web`, stop — import it.**

### One correction W0 made
`WalletSource` was missing `'UPI top-up'`. The deployed `verifyWalletTopUp` writes that exact
string (the live ledger contains it), but the enum only declared `'Top-up'`, which nothing writes.
Added `UPI_TOP_UP` and marked `TOP_UP` as unused-legacy so Batch 4's wallet screen can label a
top-up correctly.

---

## 5. Rendering strategy — decided, and why

**Public catalog → Server Components + ISR, reading Firestore with the Firebase _Web_ SDK.
Everything user-specific → Client Components + Redux thunks.**

The prompt offered the Admin SDK for server rendering. It is not needed and is **not** installed:
`firestore.rules` grants `allow read: if true` on `categories`, `categories/*/subCategories`,
`products` and `products/*/variants`. The catalog is genuinely public, so a Server Component can
read it with the same public config the browser uses — full SEO, no service-account JSON, no
server secret to manage in App Hosting. The Web SDK runs fine in Node for one-shot reads.

**The consequence to respect:** because there is no privileged server client, a Server Component
can only read what a signed-out visitor could. That is a feature, not a limitation — it makes
"never fetch user-specific data on the server" structurally true rather than a rule to remember.

| Route group | Rendering | Data source |
|---|---|---|
| `src/app/(shop)/` | Server Components, `revalidate = 300` | `src/lib/data/*` (server fetchers) |
| `src/app/(account)/` | Client, auth-guarded, `noindex` | feature `api/` thunks (Web SDK) |
| `src/app/(auth)/` | Client | `features/auth/api/` |

Never call `src/lib/data/*` from a `"use client"` file, and never fetch orders, wallet, wishlist,
cart or affiliate data in a Server Component.

---

## 6. Pagination — the promise and the mechanism differ

Spec 3.6 and 3.12 ask for numbered pages. Firestore has **no offset paging**, and faking one by
fetching-and-discarding bills a read per skipped document.

`src/components/Pagination.tsx` is a **cursor stack**: `Next` pushes the current last-document
cursor, `Prev` pops it. It renders as Prev / 1 2 3 / Next and lets the visitor step back to any
page they have already visited, because those cursors are held. **Jumping straight to page 7 is
not possible** and no amount of UI work will make it so without a separate count/offset index.

Page size is **12** (`Constants.PAGE_SIZE`), per the web skill's default.

---

## 7. Behaviour the website must inherit from the Flutter app

Both clients read the same Firestore and the same customer uses both, so these are not style
choices — a mismatch is a support ticket. Every one of these was established while building and
debugging the shipped app.

| Rule | Detail |
|---|---|
| **Order reference** | `#` + the **first 8 characters of the document id**, case preserved. There is no `orderId`/`#BRK-…` field on the order document — the design's `#BRK-48219` is mock data. This matches the admin's order list, so a customer quoting a reference finds the same string an agent sees. Never upper-case it: Firestore ids are case-sensitive. |
| **No COD** | Cash on Delivery is removed from the product. A `paymentMethod` of COD renders **no** payment-method row rather than a method the store does not offer. |
| **Delivery charge** | A combo product's charge **replaces** the standard fee, it does not add to it; with several combos, the **largest** applies, not the sum. The free-delivery threshold is waived only when no combo charge applies. Mirror the server — never re-derive. |
| **Variants** | Always the subcollection `products/{id}/variants/{id}`. There is no top-level `variants` collection (a top-level one would also poison the admin's `collectionGroup('variants')` SKU count). |
| **Wallet sources** | `'Refund'`, `'Reward'`, `'Purchase'`, `'Admin'`, `'UPI top-up'` — the strings the Cloud Functions actually write. Do not invent `'Spin reward'` / `'Order'` / `'Admin credit'`; the Flutter app carried those for weeks and matched nothing. |
| **Wallet breakdown** | One figure, **Rewards received** = `Reward` + `Admin` credits. The Refunds tile was removed. |
| **Aggregations** | A `sum()`/`average()` query needs the **aggregated field itself** in the composite index, not just the filtered fields. This silently returns `FAILED_PRECONDITION` and the UI shows zero. It has bitten this project twice — product ratings and the wallet Rewards tile. |
| **Cancel order** | The `cancelOrder` callable is owner-or-admin. A customer may cancel their own **Pending** order. |
| **Spin rewards** | Always issue a **coupon**, never wallet money. No cashback anywhere in the product. |
| **Money** | Never computed or written client-side. Display stored values; let the Cloud Functions price everything. |
| **Status colours** | Delivered → success green · Shipped / Out for delivery → **info blue** · Cancelled → **neutral grey, not red** (a customer cancelling is a normal outcome) · Rejected / Failed → error red. Labels render **as stored**, sentence case — never upper-cased. |
| **Product card** | Price line, then a second line carrying `NN% off` and the rating. Cramming both onto one row is what clipped `₹3,240` to `₹21…` in the app. |

---

## 8. Prototype coverage vs the 25 spec sections

Covered by `Barakath Website Prototype.dc.html`: 3.1 header · 3.2 footer · 3.3 auth (mobile,
register, create profile) · 3.4 home (category strip, flash sale, new arrivals, best sellers) ·
3.5 categories · 3.6 listing · 3.7 product detail (+ description, specs, frequently-bought,
reviews) · 3.8 cart/checkout · 3.9 order success ("Nice — that's on its way!") · 3.10 orders +
detail + track + return + invoice · 3.13 wallet + coupon wallet · 3.14 spin · 3.15/3.16 affiliate
dashboard, bank account, withdrawal · 3.17 addresses · 3.18 notifications · 3.19 settings, privacy,
terms, help, delete account · 3.21 payment failed · 3.23 logout.

Thin or absent, so **the spec governs** and you should expect to design within the token system:
**3.11 replacement status detail**, **3.12 wishlist**, **3.20 search results page**,
**3.22 banner products page**, **3.24 responsive rules** (stated as breakpoints, not drawn),
**3.25 loading/empty/error states** (only "No connection" is drawn).

Two mismatches worth knowing before you build:

- The design draws a **"Best sellers"** home section. W4 says the **"Best Seller" _badge_** is
  removed — those are different things. The section stays; the per-card badge does not.
- The design's order reference reads `#BRK-48219`. See §7 — that format does not exist in the data.

---

## 9. Login — verified end to end, and one bug W0 fixed

The flow is MSG91 OTP, mirroring `apps/app/.../auth_remote_datasource.dart`. There is no Firebase
phone-auth reCAPTCHA anywhere in it: the server verifies the code and mints a **custom token**.

```
phone  -> authOTP   { phone: '10 digits', countryCode: '+91' }        -> { success, message }
otp    -> verifyOTP { phone, countryCode, otp }
             -> { verified: true, customToken, isNewUser } | { verified: false }
          then signInWithCustomToken(customToken)
new?   -> isNewUser === true  ->  profile step, then merge into users/{uid}
```

**Probed live against the deployed functions (no SMS sent — the calls fail before MSG91 is reached):**

| Call | Result |
|---|---|
| `asia-south1/verifyOTP` bad phone | `400 INVALID_ARGUMENT` "Enter a valid 10-digit Indian (+91) mobile number." |
| `asia-south1/verifyOTP` valid shape, no pending request | `400 FAILED_PRECONDITION` "This code has expired." |
| `asia-south1/authOTP` bad phone | `400 INVALID_ARGUMENT` |
| CORS preflight from `http://localhost:3000` | `204`, `access-control-allow-origin` reflected |
| **`us-central1/verifyOTP`** | **`404 Page not found`** |

That last row was the bug. `lib/firebaseConfig.ts` called `getFunctions(app)` with no region, which
resolves to `us-central1`, **where nothing is deployed**. Login would have failed with a generic
"internal error" and *no Cloud Function log at all*, because the request never arrived — the hardest
possible thing to debug. Now pinned via `CloudFunctions.region` in `src/config/cloudFunctions.ts`.

Things W3 must get right, all of which are load-bearing:

- **`{ verified: false }` is a wrong code, not an error.** It is a normal 200 response. Show it inline
  under the OTP field; do not throw and do not clear the phone number.
- **`isNewUser` decides the profile step.** `verifyOTP` has already created the Auth account *and* the
  `users/{uid}` document with empty `fullName`/`email`. The profile screen is a **merge** into an
  existing doc, never a create — `firestore.rules:119` is `allow create, delete: if false`.
- **The pending OTP expires in 15 minutes** and is deleted the moment a code is accepted, so it cannot
  be replayed. After that window `verifyOTP` returns `FAILED_PRECONDITION`, which the UI should render
  as "request a new code", not as a failure.
- **The session cookie is W3's job.** `middleware.ts` only checks that `barakath_session` is present;
  the Web SDK keeps its session in IndexedDB, which the Edge cannot see. Sign-in must POST the ID
  token to a route handler that sets the cookie, and sign-out must clear it — otherwise the middleware
  redirects a signed-in customer straight back to `/login`. It is a redirect, not a security boundary:
  Firestore rules are the real gate.
- **Identity comes from the verified phone**, never from anything the client sends. Do not add a uid,
  a phone override or a "trust me" flag to the callable payload.
- `authOTP`/`verifyOTP` have **no auth gate on purpose** — the caller has no Firebase identity yet.

### 9.1 The website has its own MSG91 widget — send `source: 'web'`

The site and the customer app use **separate MSG91 widgets with different widget ids**. As of
2026-07-24 the three OTP callables select the widget from a `source` field:

- **`authOTP` MUST be called with `source: 'web'`** from the website. The server resolves the web
  widget, sends the code, and **stores the source on the pending request**.
- **`verifyOTP` and `resendOTP` take no source** — the server reads it back from the stored request
  and acts on the widget that issued the `reqId`. A reqId is not portable between widgets, so this is
  the only way verify can succeed.
- Omitting `source` resolves to the **app** widget (that is how the deployed Flutter app, which sends
  nothing, keeps working). On the web that means the code is sent from one widget and verified against
  another — verify fails with no visible cause. `src/config/cloudFunctions.ts` carries the field as
  `OTP_SOURCE: 'web'`; pass it and do not hardcode the string.

Deploy prerequisite: set **`MSG91_WIDGET_ID_WEB`** (and `MSG91_TOKEN_AUTH_WEB` only if the web widget
has its own token) in `functions/.env`, then redeploy `authOTP`, `verifyOTP`, `resendOTP`. Until that
value is set the web source falls back to the app widget, so nothing breaks — but web sign-in will use
the app widget's branding/limits until it is filled. One open question I could not resolve from code:
the app widget rejects MSG91's `/sendOtp` (web) route, so the server uses `/sendOtpMobile` for both.
If the web widget is configured to reject mobile-route requests, the first live web send will fail and
`sendOtp` in `msg91Client.ts` will need a route branch by source. Worth testing on the first real
web OTP.
