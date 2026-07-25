# Web storefront — design-matching audit (live Playwright)

Full-site audit of `apps/web` against its design mockups, run live against the dev server
(`http://localhost:3111`) using Playwright, logged in as the demo test account (phone
`8590941583`). Report-only — no code changed as part of this pass.

**Design files used:** `Barakath Website.dc.html` (35 numbered screens, primary source — easy
single-line-per-screen format) plus `Barakath Website Prototype.dc.html` (the authoritative,
newer superset per `WEB_BATCH1_NOTES.md` §1, used only for the ~10 screens the primary file
doesn't cover: Privacy, Terms, Payment failed, 404, No connection, Delete account, Register,
Referral landing, Help & contact).

**Known limitation:** MSG91 (the real OTP provider) rate-limited the shared demo phone number
after the first couple of logins, since all 5 audit lanes ran concurrently against the same
test account. Screens noted "code-verified" below were confirmed against the live, deployed
source code and cross-checked against WEB_BATCH1–4_NOTES rather than a live screenshot — findings
are still concrete and traceable to real files, just not visually screenshotted in this pass.

Every finding below was checked against `WEB_BATCH1_NOTES.md` through `WEB_BATCH4_NOTES.md`
first — a large number of apparent "mismatches" turned out to be deliberate, documented decisions
(no COD, no fake `#BRK-xxxxx` order IDs, spin always issues a coupon never cash, referral is
copy-only with no link, delete-account mirrors a known Flutter gap, etc.). Those are marked
**intentional** below and are not bugs.

---

## Priority findings (real, undocumented issues — recommend fixing)

### P0 — broken or inconsistent behavior
1. **`/payment-failed` "Retry Payment" button is broken** — both "Retry Payment" and "Back to
   Cart" route to `/cart` (`router.push('/cart')` and `href="/cart"` — confirmed identical in
   `apps/web/src/app/(checkout)/payment-failed/page.tsx:113-121`). The design has them going to
   two different places (retry → straight back into checkout; back → the bag). Today, retrying a
   failed payment doesn't actually retry anything — it just dumps the customer at the cart.
2. **Header logout has no confirmation** — `apps/web/src/components/layout/header/AccountMenu.tsx`
   calls `logout()` directly on click with no dialog. The account sidebar's logout
   (`LogoutDialog.tsx`) DOES show a confirm dialog first. Same action, two entry points, two
   different (inconsistent) behaviors.
3. **Delete-account has no OTP re-verification step** — the design's `show.deleteAccount` screen
   explicitly shows "We'll send an OTP to verify before deleting"; the built `DangerZone.tsx` flow
   goes straight from one confirm dialog to permanent deletion, no re-auth step at all.
4. **404 page is completely unstyled** — `apps/web/src/app/not-found.tsx` doesn't exist, so Next.js
   renders its bare default ("404 | This page could not be found.", no header, no branding, no
   button). The design shows a fully-branded 404 with a "Back to home" CTA.
5. **Home page is missing the "Best sellers" section** — `WEB_BATCH1_NOTES.md` §8 explicitly says
   this section should stay (only the per-card badge was meant to be removed). `getBestSellers()`
   already exists in `apps/web/src/lib/data/catalog.ts` but `apps/web/src/app/(shop)/page.tsx`
   never calls it.

### P1 — real structural/layout mismatches (lower urgency)
6. **Help & Support doesn't exist at all** — no FAQ, no contact cards, no dedicated page anywhere.
   The design shows this content behind the same sidebar nav slot the built app uses for
   "Settings" (which shows completely different content). The only live "help" surface is the
   footer's Support column, which currently shows "Support details coming soon" (no `contactus`
   data configured yet — a content gap, not a code bug).
7. **Affiliate Wallet layout differs** — design: one large gradient hero card ("Total earnings") +
   a 3-tile row. Built: a uniform 2×3 six-tile `StatCard` grid, no hero treatment.
8. **Spin & Win layout differs** — design: wheel and coupon-wallet side by side. Built: stacked
   vertically. (The design's static "possible prizes" showcase grid is correctly NOT built — one
   of its tiles describes a cashback reward type that can't exist in the real data model, so
   omitting it is right, not a bug.)
9. **Spin reward result isn't the full-bleed hero the design shows** — built renders a compact
   bordered card under the wheel; design shows a large centered "You won ₹X!" hero treatment.
10. **Notifications list has no per-type icons** — design shows a colored icon badge per
    notification type (truck/gift/check/wallet) with a tinted background for unread; built shows
    a plain row with only a small dot for unread state.
11. **Address picker has no "Edit" action and no explicit confirm step** — design shows an "Edit"
    link per saved address and a "Deliver here" confirm button; built only supports delete+add
    (no edit), and selecting an address in the picker immediately closes the modal.
12. **Referral & withdraw is a separate page, not an inline panel** — design shows the withdraw
    form inline on the same screen as the referral code; built routes to
    `/account/affiliate-wallet/withdraw`. Functionally equivalent, visually different.

### P2 — minor copy/cosmetic differences (optional)
- Order confirmation heading: "Order placed" vs design's "Nice — that's on its way!"
- Payment-failed body copy and button label wording differ slightly ("Back to Cart" vs the site's
  own "Bag" terminology elsewhere — a small internal inconsistency)
- Register/create-profile step: field order and CTA copy ("Enter Barakath" vs design's "Create
  account") differ; a "Skip for now" option was added
- Search results page omits the design's restated search box + quick-suggestion chips (spec
  marked "thin" for this screen, so this is a defensible simplification, not a clear bug)
- "No connection" (offline) state isn't built at all — a commonly-cut corner, not urgent

---

## Full screen-by-screen results

### Lane A — Shop & Discovery (no login required, fully live-tested)
| # | Screen | Verdict |
|---|---|---|
| 01 | Home | Partial — missing Best Sellers (P0 #5); flash sale correctly hidden when none active |
| 13 | Categories | Match |
| 02 | Category listing | Match |
| 03 | Product detail | Match |
| 12 | Search | Partial — missing search-box restate + suggestion chips (P2) |
| — | Banner products page | Match |
| — | Privacy Policy | Match (shows correct "not published yet" empty state — intentional) |
| — | Terms & Conditions | Match (same empty-state pattern as Privacy) |

### Lane B — Cart & Checkout (login blocked by rate-limit after screen 1; rest code-verified)
| # | Screen | Verdict |
|---|---|---|
| 04 | Shopping bag | Partial — GST row shown, correctly per WEB_BATCH3 notes (intentional) |
| 05 | Checkout | Could not test live; code-verified Match on no-COD, single Razorpay row |
| 16 | Address selection | Could not test live; code-verified Partial — no Edit action (P1 #11) |
| 17 | Add address | Could not test live; code-verified Partial — extra fields, 1-col vs 2-col layout |
| 18 | Razorpay payment | Could not test (real gateway UI, not reproducible/testable safely) |
| 06 | Order confirmation | Partial — copy differs (P2), correct real order-ID format |
| — | Payment failed | Match structurally, but **Retry button is broken** (P0 #1) |

### Lane C — Account core (login succeeded once; rate-limited after — rest code-verified)
| # | Screen | Verdict |
|---|---|---|
| 07 | Sign in | Match (fully live-tested, including real sign-in) |
| 32 | Register | Partial — field order/CTA copy differs (P2) |
| 08 | Account dashboard | Code-verified; adds a Wishlist nav item design doesn't show |
| 19 | Order detail | Code-verified Partial — consolidated layout vs design's 3-button row |
| 21 | Invoice | Code-verified — built is a proper GST tax invoice, richer than the mockup |
| 20 | Tracking timeline | Code-verified — matches concept, omits live rider distance (no data source) |
| 22 | Return/cancel request | Code-verified — adds required photo upload + required note (real requirement) |
| 33 | Saved addresses | Code-verified Match; no edit capability (by design, per code comment) |
| 30/31 | Personal info / Settings | Code-verified Partial — correctly merged into one page; no photo upload |
| 35 | Log out confirmation | **Header entry point has no dialog at all** (P0 #2) |
| — | Delete account | **No OTP re-verification step** (P0 #3) |

### Lane D — Wallets & Rewards (1 login succeeded then rate-limited; rest code-verified)
| # | Screen | Verdict |
|---|---|---|
| 09 | Normal Wallet | Code-verified Partial — 2 tiles not 3 (cashback removed, intentional) |
| 10 | Affiliate Wallet | Code-verified Partial — **tile layout differs from design** (P1 #7) |
| 11 | Spin & Win | Code-verified Partial — **stacked not side-by-side** (P1 #8) |
| 15 | Coupons & spin rewards | Code-verified — no manual "enter code" field on this page (belongs at checkout) |
| 26 | Reward result | Code-verified — **compact card, not full-bleed hero** (P1 #9) |
| 27 | Coupon | No separate detail screen exists — same as #15, by design |
| 23 | Affiliate dashboard | Match — same page as #10, deliberately merged per code comment |
| 24 | Referral & withdraw | Code-verified Partial — **separate page not inline** (P1 #12); referral is copy-only (intentional) |
| 25 | Add bank account | Code-verified — extra confirm field + IFSC auto-resolve (more robust than design) |
| 34 | Complete withdrawal | Code-verified Match |
| — | Referral landing ("Give ₹100") | Confirmed absent — intentional, matches Flutter (no link mechanism at all) |

### Lane E — Notifications & Support
| # | Screen | Verdict |
|---|---|---|
| 28 | Notifications | Partial — **no per-type icons, dot instead of tint** (P1 #10) |
| 29 | Help & support | **Not built at all** (P1 #6) |
| — | Wishlist | No design counterpart — real, working feature (like admin's Addresses tab) |
| — | 404 | **Completely unstyled default page** (P0 #4) |
| — | No connection | Not built — commonly-cut corner (P2) |

---

## Suggested next step
This pass is report-only per your instruction. Let me know which of the findings above you'd like
fixed — I'd suggest starting with the P0 list (5 items, all small/contained fixes), then P1 as a
second pass.
