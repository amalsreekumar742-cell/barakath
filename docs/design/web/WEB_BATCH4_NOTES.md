# WEB_BATCH4_NOTES.md — corrections layer over `Barakath_Web_Batch4_Prompts.md`

Authoritative over both the spec and the pasted Batch 4 prompt doc, per this project's established
convention (`WEB_BATCH1/2/3_NOTES.md`). Verified against live deployed code before any Batch 4 session
started. Read this BEFORE the pasted prompt doc's own text where the two disagree.

## 1. Referral link — SCOPE CUT. Copy-only, code-based. No link, no middleware, no landing page.

The pasted doc's "conflict 1" assumed building a `?ref=` cookie-capture path was cheap and recommended
it. Decision after checking `apps/app`: **do not build it.** The Flutter app has NO link/deep-link
mechanism at all — `apps/app/lib/features/affiliate/presentation/widgets/referral_code_card.dart`'s
`_share()` shares plain invite TEXT carrying the CODE (`'Shop with Barakath and use my referral code
$code when you sign up.'`), and `create_profile_page.dart` has a manual "Friend's code" text field a new
signup types into. There is no referral landing page, no deep-link handler, nothing to mirror for a link.

**What ships instead (D0, D4):**
- D0: **skip prompt §4 entirely** — no `src/middleware.ts` referral-capture change, no
  `src/features/account/referral.ts`, no `getReferralCode()`/`clearReferralCode()` helpers, no signup-flow
  wiring for a cookie. `trackReferralSignup` stays wired the same way Flutter wires it (see below).
- D4: the referral section is code-only — large monospace code, **Copy** button, and **Share** using the
  Web Share API sharing the same style of invite TEXT Flutter shares (code, not a link), with a
  clipboard-copy fallback for browsers without `navigator.share`. No referral link line, no second
  Copy button for a link.
- Signup-time capture: the website's `create-profile`/signup step should offer the SAME manual "Friend's
  code" entry Flutter has (an optional text field), calling `trackReferralSignup` the same way, rather
  than any cookie/URL mechanism. This is a reasonable, small addition to W3's existing profile-creation
  step — same shape as Flutter's, not a new pattern.

## 2. Delete account — mirror Flutter EXACTLY, including its known gap. No firestore.rules change.

Confirmed live in `apps/app/lib/features/profile/data/datasources/profile_remote_datasource.dart`
(`anonymiseAccount`): the write is two steps —
1. `users/{uid}.update({ fullName: '', email: '', whatsapp: '', profileImage: '', fcmToken: '',
   keywords: [], updatedAt: serverTimestamp() })` — must succeed; this is the real anonymisation.
2. `users/{uid}.update({ status: 'Blocked' })` — best-effort, **swallowed on failure**.

Checked live `firebase/firestore.rules` (`onlyOwnProfileFields()`, line ~33-38): `status` is NOT in the
allowlist (`fullName, email, whatsapp, profileImage, referredBy, keywords, fcmToken, updatedAt` only).
**This means step 2 is silently rejected today, on both clients** — a deleted account's PII is wiped but
the account is not actually blocked from signing back in. This is a real, pre-existing gap.

**Decision: D5 mirrors this exactly, including the gap.** Do the identical two-step write (same field
list, same catch-and-swallow on the `status` update), and do NOT touch `firestore.rules` in this batch —
loosening it only for the web client would make the two clients diverge WORSE (web blocks, app doesn't),
which is the opposite of the "never patch one side" rule this batch itself states. `_clearWishlist`
(bounded-batch wishlist deletion) has no direct Firestore-rules equivalent needed on web — reuse
`users/{uid}/wishlist` deletion the same bounded-batch way Flutter does (see that file's
`_wishlistBatchSize`/`_maxWishlistBatches` constants) rather than an unbounded loop.

Flag this gap explicitly in D6's `docs/PHASE7_COMPLETE.md` as an inherited, cross-client limitation — not
something this batch introduced or is expected to fix.

## 3. `cancelOrder` is NOT admin-only — the pasted doc's own conflict text is wrong here

The prompt doc (D1 §2, and the "carried over unchanged" note) claims `cancelOrder` (spec 5.2 #5) is
"ADMIN auth" and tells D1 to stop and report if a customer call is rejected. Checked live
`functions/src/orders/cancelOrder.ts`: `isAdmin = request.auth?.token.admin === true` (line 35), then
`if (!isAdmin && !ownsOrder) throw ...` (line 55) — **the owning customer is already explicitly allowed.**
D1 should wire "Cancel" directly against `cancelOrder({ orderId })` for the signed-in customer with no
special-case handling and no need to stop/report — this is already correct, deployed, working.

## 4. Replacement request ID — the "shared counter" is dead code on BOTH clients today

The pasted doc's conflict 4 assumes a working transactional counter exists on `general/config` that both
clients must share. It doesn't work in practice. Checked
`apps/app/lib/features/replacement/data/datasources/replacement_remote_datasource.dart`
(`_nextRequestId`): it DOES attempt `runTransaction` on `general/config.replacementCounter` first, but
`firestore.rules` gives `general/{docId}` `allow write: if isAdmin()` only — **the transaction always
fails permission-denied for a real customer**, is caught, and Flutter falls back to
`'#RP-' + (docId.hashCode.abs() % 10000).toString().padLeft(4, '0')` — a hash of the replacement
document's own Firestore auto-id, NOT a true sequential counter. This fallback is what every real
customer request actually gets today; the "preferred" transaction path is currently unreachable code for
a customer on either client.

**Decision for D1:** attempt the identical transaction first (forward-compatible: the day rules gain a
customer-write path for this counter, both clients pick it up for free, matching Flutter's own stated
intent), catching the same permission-denied failure. In the fallback, derive the 4 digits from the
website's own Firestore-assigned doc id — bit-for-bit replicating Dart's `String.hashCode` in JavaScript
is impractical and not actually load-bearing: Flutter's own fallback was never a hard uniqueness
guarantee (a 4-digit space, `% 10000`, already collides across DIFFERENT Flutter-only requests with
non-zero probability) — it is a cosmetic display reference, not a primary key (the real key is the
Firestore document id). Use any deterministic hash of the doc id (e.g. a simple string hash mod 10000) and
document this reasoning inline. Report this finding in D6's close-out doc rather than treating it as a
solved problem — it is an inherited Flutter-side limitation, not a website defect.

Document id allocation must still match Flutter's pattern: mint the id client-side via
`doc(collection(...))` (no write yet), upload photos under that id, then create the document once with
the finished photo URL list — `firestore.rules` gives `replacements/{id}` update to admin only, so a
create-then-update sequence (matching Flutter's own documented reasoning) would strand a photo-less
request on the update step.

## 6. D0 is merged — real findings from the foundation build (read before D1-D5 start)

D0 (account shell, `usePaginatedCollection`, `CouponWallet`, shared account UI) is built and verified
clean (`tsc --noEmit`, `eslint`, `next build` all pass). What it left behind, and what it found that
disagreed with the prompt doc and even with this notes file's own §1:

- **Referral capture (§1 above) was ALREADY FULLY BUILT before this batch** — do not build it again.
  `features/auth/components/ProfileStep.tsx` already has the "Friend's code" optional text field, and
  `useAuthFlow.ts`'s `saveProfile` already writes `referredBy` onto the new user's doc. `trackReferralSignup`
  is a **Firestore trigger** (`onDocumentWritten('users/{userId}')` in `functions/src/growth/trackReferralSignup.ts`),
  not an HTTP callable as spec 5.2 implies — that write alone fires it, no client call needed anywhere.
  Self-referral is already blocked server-side. **D4 needs to do nothing here except read/display the
  code** — see the field-name correction below.
- **There is no separate `referralCode` field.** `UserProps` (packages/shared/src/types/user.ts) has only
  `affiliateCode: string` — this ONE field is both "the code that gates whether Affiliate Wallet shows in
  the sidebar" AND "the code a customer shares to refer others." D4 should read `user.affiliateCode` for
  the Copy/Share card — there is nothing else to look for.
- **There is no `isAffiliate` boolean field.** Gate affiliate-only UI on `!!user.affiliateCode?.trim()`,
  matching what D0 already did in the sidebar and what Flutter's own `isAffiliate` getter effectively
  checks.
- **The real avatar field is `profileImage`, not `profilePhoto`.**
- **`spinRewards` still doesn't exist as a collection** (matches the established finding from earlier
  batches this session): a spin win mints an ordinary `coupons` doc (`createdBy: <uid>`, `SPIN-` code
  prefix, `usageLimit: 1`, `perUserLimit: 1`). D3 (Spin & Win) must NOT query a `spinRewards` collection —
  there isn't one. D0's `CouponWallet` already derives its Active/Used/Expired tabs from `usedCount`/
  `validUntil` on `coupons` docs filtered by `createdBy == uid` — D3 renders that exact component
  (`variant="embedded"`) rather than building any of its own reward-listing logic.
- **`coupons/{id}/usageHistory` is unreadable client-side** — no Firestore rule grants it. "Used on order
  #…" (wherever a used coupon needs to show what it was used on) is resolved by querying `orders` (owner-
  readable) for a matching `couponCode`, best-effort, non-fatal on failure — see `CouponWallet`'s own
  implementation for the pattern.
- **Pre-existing Redux slices already carry pagination-shaped reducers** — `ordersSlice`, `walletSlice`,
  `affiliateSlice`, `notificationsSlice` (from earlier scaffolding) already have `setXPage`-style reducers
  that don't line up cleanly with the plain-hook shape of `usePaginatedCollection`. Each of D1/D2/D3/D4/D5
  should look at its own slice before wiring its list and decide, per screen, whether to use the hook
  standalone (simplest, matches D0's own usage in `CouponWallet`) or adapt the hook's output into the
  existing slice shape — do not fight the slice if adapting is cheaper, and do not delete the slice's
  existing pagination reducers without checking nothing else in that slice depends on them.
- **No `LogoutDialog` existed anywhere in the codebase** before D0 (the header's `AccountMenu` logs out
  with zero confirmation today, a pre-existing gap against spec 3.23 outside D0's file scope — flag it
  again in D6's close-out doc). D0 built `features/account/components/LogoutDialog.tsx` from the existing
  `ConfirmDialog` + `useLogout` hook — import that, do not rebuild it.
- `eslint.config.mjs`'s `FEATURES` array now includes `account` and `coupons`, with a `coupons → account`
  one-directional exception (`CouponWallet` reaches `usePaginatedCollection`). Two new composite indexes
  were added to `firebase/firestore.indexes.json` for the coupon-wallet tab queries — if your own screen
  needs a new composite index, add it there too rather than a second indexes file.

## 7. Wallet top-up is TWO dedicated functions, not `createPaymentOrder` + `addWalletMoney`

The pasted doc's D2 §2 tells the session to call `createPaymentOrder` with `{ purpose: "wallet_topup",
amount }` then `addWalletMoney` to credit — neither claim matches the deployed code. Checked
`functions/src/wallet/`:

- **`createWalletTopUpOrder({ amount })`** → `{ topUpId, razorpayOrderId, amount, key_id }`. A completely
  separate callable from `createPaymentOrder` (deliberately — see its own doc comment: a top-up has no
  cart/address/stock, so branching `createPaymentOrder` with a purpose flag would put a conditional in
  front of every checkout step). Validates `amount > 0` server-side (min ₹1, max ₹100,000 — a blast-radius
  guard, not a stated business rule), checks the store's wallet-enabled flag, and writes a `walletTopUps`
  doc BEFORE opening the Razorpay order (so the amount that gets credited later can never come from the
  client).
- **`verifyWalletTopUp({ razorpay_order_id, razorpay_payment_id, razorpay_signature })`** →
  `{ verified: boolean, amount, newBalance }` on success (`{ verified: false }` on a bad signature — the
  function does not throw for that case, check the boolean). HMAC-verifies server-side, checks the caller
  owns the `walletTopUps` doc, then atomically flips it to `Paid` and credits `walletBalance` in one
  transaction — idempotent against a retried call (checks `status === 'Paid'` first and returns the
  already-settled balance rather than double-crediting).

**D2's real flow:** `createWalletTopUpOrder({amount})` → open Razorpay Checkout with the returned
`razorpayOrderId`/`key_id` (via C0's existing Razorpay script loader, same as checkout) → on the SDK's
success callback, call `verifyWalletTopUp({...})` → if `verified`, the balance already updated server-side
(the page's `onSnapshot` on `users/{uid}` will reflect it, per the brief's own §1 balance-card design —
`newBalance` in the response is a nice-to-have for an instant toast, not something to write anywhere) →
if not verified or the call throws, toast and let the customer retry. No `addWalletMoney` call anywhere;
it does not exist.

## 8. Spin & Win's ENTIRE data model in the pasted doc is wrong — read this before D3 starts

The pasted doc (D3, and spec Part 4.14) describes `spinnerCampaigns/{id}/offers` (a sub-collection) and
`spinnerCampaigns/{id}/spinUsage` (per-user-per-day usage docs), plus a per-campaign `eligibility` field
("All users"/"New users"/"Affiliates") and a `spinsPerUserPerDay` allowance. **None of this exists.**
Verified against the real deployed callable (`functions/src/growth/spinWheel.ts`) and the shared type
(`packages/shared/src/types/spinnerCampaign.ts`), which the admin panel and any client must already agree
with since it's shared:

- **Slots are embedded directly on the campaign document** — `SpinnerCampaignProps.slots:
  SpinnerSlotProps[]`, each `{ id, label, type: 'Coupon'|'Better luck', couponCode, couponId,
  discountType, discountValue, minimumOrderAmount, maximumDiscount, probability, color }`. There is no
  `offers` sub-collection. Build the wheel wedges straight from `campaign.slots` — `slot.color` is
  already the wedge fill the admin chose, use it rather than inventing alternating theme colours.
- **No `eligibility` field exists at all.** The wheel is open to any authenticated user; there is no
  "New users"/"Affiliates" restriction to check or render an explanation for. Do not build that UI.
- **Spin limiting is LIFETIME + an hours cooldown, not daily.** `spinWheel` checks
  `campaign.maxSpinsPerUser` (a lifetime cap, via a `.count()` aggregation over the top-level
  `spinHistory` collection filtered by `campaignId`+`userId`) and `campaign.spinCooldownHours` (hours
  since the user's last spin in that same history, via an `orderBy('createdAt','desc').limit(1)` read) —
  there is no `spinUsage` sub-collection, no per-day date-string keying, no `spinsPerUserPerDay` field.
  Compute "spins remaining" client-side the same way: `maxSpinsPerUser - count(spinHistory where
  campaignId==X and userId==uid)`, and read the cooldown the same way if you want to grey the button
  between spins — but the SERVER is still the one that actually enforces both (`failed-precondition` with
  a human-readable message on either), so a client miscalculation only affects the button's disabled
  state, never correctness.
- **`spinWheel({campaignId})` does NOT return an `offerId`.** Its real response is
  `{ resultType: 'Coupon'|'Better luck', slotLabel: string, couponCode?, couponDetails?: { code,
  discountType, discountValue, minimumOrderAmount, maximumDiscount, validUntil (epoch ms) } }`. To land
  the wheel animation on the right wedge, match the returned `slotLabel` against `campaign.slots[].label`
  (string equality) to find the index — campaign slot labels are admin-authored and expected unique in
  practice, but this is a string match, not an id match, so document that assumption inline rather than
  silently trusting it. `resultType === 'Better luck'` is the loss case (spec's existing "Better luck next
  time" copy); `resultType === 'Coupon'` is the win case, and `couponDetails` already has everything the
  result card needs (no cashback type exists in the callable at all — confirms the doc's own "no cashback"
  expectation, nothing to build defensively against there).
- **The won coupon is an ordinary `coupons` doc** (see §6 above) — after a win, refresh D0's `CouponWallet`
  (`variant="embedded"`) rather than tracking the new coupon separately; it will already show under Active
  since `createdBy` is set to the spinning user's uid.

## 9. The withdrawal collection is `affiliateWithdrawals`, not `withdrawalRequests`

The pasted doc calls it `withdrawalRequests` throughout D4 and D6 — that collection name does not exist
in `firestore.rules`. The real, deployed rule (verified) is `match /affiliateWithdrawals/{withdrawalId}`:

- `allow read`: admin, or the owning customer (`resource.data.userId == request.auth.uid`).
- `allow update`: admin only. `allow delete`: never.
- `allow create`: signed-in, AND `request.resource.data.userId == request.auth.uid`, AND
  `status == 'Pending'`, AND `amount is number && amount >= 10000 && amount <=` the CALLER'S OWN
  `affiliateBalance` read server-side from their `users/{uid}` doc (so a tampered client cannot request
  more than it has), AND `rejectionReason == ''`, AND `processedBy == ''`. These five fields are what the
  rule actually enforces — D4 may still write additional fields alongside them (bank-details snapshot,
  `processingFee`, `netAmount`, `keywords`, `createdAt`, `updatedAt` etc. per the pasted doc's own field
  list), the rule simply doesn't constrain those. Use the exact field names `rejectionReason` and
  `processedBy` for the admin-owned resolution fields (not whatever names, if any, the pasted doc
  implies) — those are the two the rule checks are empty on create.
- There is still no `createWithdrawalRequest` callable — this remains the one legitimate client-side
  financial write in the whole project, exactly as the pasted doc says, just under the correct collection
  name. D6's sweep should grep for `affiliateWithdrawals`, not `withdrawalRequests`.

## 5. Avatar upload asymmetry — no decision needed, proceed as prompted

D0 proceeds exactly as the pasted doc says (render `users/{uid}.profilePhoto` when present, else
initials; no upload UI, matching spec 3.19's omission). Just carry the flag through to D6's close-out doc
as the pasted doc already asks.
