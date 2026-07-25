# Batch 4 — Design Map

Produced by the Batch-4 foundation session (2026-07-23). **Read this instead of re-deriving the
prototypes.** Feature sessions: use the tokens in `lib/core/theme/` + `lib/core/constants/app_colors.dart`
and `app_dimens.dart`; do not hardcode colours, radii or spacing.

> **Precedence, in order:** spec → newest prototype → older prototype.
> The prototypes are layout / spacing / component-shape / visual-hierarchy reference ONLY. On any
> field, label, wording, validation or business rule, **the spec wins** — the conflicts where that
> actually bites are listed in §4 and are NOT optional to get right.

---

## 1. The three files

| File | Modified | What it is |
|---|---|---|
| `Barakath Customer App.dc.html` | 2026-07-23 11:02 | **NEWEST — the authority.** 41 numbered screen frames on one canvas. |
| `Barakath Customer App (standalone).html` | 2026-07-23 11:02 | **Byte-identical design**, JS-string-escaped with the design-system bundle inlined for standalone viewing. Same 41 frames, same 560 component imports. **Not a second opinion — do not diff against it.** |
| `Barakath_Prototype_dc.html` | 2026-07-16 17:30 | **OLDER.** Clickable prototype driven by `show.<screen>` flags. Fewer screens, coarser detail. Use only where the newest file has no frame. |

Because the two 2026-07-23 files are the same design, **there is exactly one prototype disagreement
axis: newest-dc vs the 2026-07-16 prototype.** See §3.

Screen frames are captioned `NN · Name` in the dc files. The source has a numbering bug — **two frames
are both numbered 26** ("26 · Return status" and "26 · Normal Wallet"). Cite frames by name, not number.

---

## 2. Batch-4 screen coverage

✅ = covered, ⚠️ = partial, ❌ = no coverage (design from spec + established visual language).

| Batch-4 screen | Newest dc | 2026-07-16 prototype | Frame name |
|---|---|---|---|
| Orders list | ✅ | ✅ | `21 · Order list` / `show.orderList` |
| Order detail | ✅ | ✅ | `22 · Order detail` / `show.orderDetail` |
| Tracking | ✅ | ✅ | `23 · Tracking timeline` / `show.tracking` |
| Invoice | ✅ | ✅ | `24 · Invoice` / `show.invoice` |
| Replacement request | ✅ | ✅ | `25 · Return request` / `show.returnReq` |
| Replacement status | ✅ | ❌ | `26 · Return status` — **no Batch-4 route owns this**; it is the state shown inline on Order Detail per item |
| Wallet | ✅ | ✅ | `26 · Normal Wallet` / `show.normalWallet` |
| Add money | ✅ | ✅ | inline panel `Wallet · Add money` inside the Normal Wallet frame |
| Profile | ✅ | ✅ | `36 · Profile` / `show.profile` |
| Edit profile | ✅ | ❌ | inline panel `Profile · Edit profile` inside frame 37 |
| Settings | ✅ | ✅ | `37 · Settings & personal info` / `show.settings` |
| Help centre | ✅ | ✅ | `35 · Help & support` / `show.support` |
| Wishlist | ⚠️ | ⚠️ | `Browse · Wishlist` panel in the Category section — a product grid, no dedicated full frame |
| Affiliate dashboard | ✅ | ✅ | `27 · Affiliate dashboard` / `show.affiliateDash` |
| Affiliate wallet | ✅ | ✅ | `28 · Affiliate Wallet` / `show.affiliateWallet` |
| Withdraw | ✅ | ✅ | `29 · Referral & withdraw` + `39 · Complete withdrawal` / `show.referral`, `show.completeWithdraw` |
| Bank accounts (list) | ❌ | ❌ | **No frame.** Only the *add* form exists. Build the list from the spec (§2.22 max 2). |
| Add bank account | ✅ | ✅ | `30 · Add bank account` / `show.addBank` |
| Spin | ✅ | ✅ | `31 · Spin & Win` / `show.spin` |
| Spin result | ✅ | ✅ | `32 · Reward result` / `show.spinResult` |
| My coupons | ✅ | ✅ | `33 · Coupon wallet` / `show.couponWallet` |
| Write review | ✅ | ❌ | inline sheet `Orders · Rate purchase` + `Orders · Rating submitted` inside the frame-21 group |
| Notifications | ✅ | ✅ | `34 · Notifications` / `show.notifications` |

**Zero coverage — design from spec alone:** Bank accounts list.
**Thin coverage — extrapolate from the established language:** Wishlist (grid only), Replacement status
(inline state, not a screen).

---

## 3. Where the two prototypes disagree

Only three matter; in all three **follow the newest dc file**.

1. **Write review** — newest dc has a full `Rate your purchase` bottom sheet (large tappable stars,
   "How was it? / Tap a star to rate", optional-text field, `Add photos` tiles, `Submit rating`) plus a
   `Thank you! / Done` confirmation. The 2026-07-16 prototype has **no review UI at all**.
2. **Edit profile** — newest dc has a dedicated `Profile · Edit profile` panel (Change photo, Display
   name, WhatsApp number (optional), Email address, Friend's code (optional), Save changes). The older
   prototype folds everything into Settings with no separate edit surface.
3. **Replacement status** — newest dc adds a `Return status` frame (status timeline: Request raised →
   Under review → Pickup scheduled). The older prototype stops at the request form.

---

## 4. Design ↔ spec conflicts — SPEC WINS, do not copy the prototype here

These are real and each one will otherwise ship a bug:

| # | Prototype shows | Spec says | Build |
|---|---|---|---|
| 1 | Wallet breakdown has **three** tiles: Rewards / Cashback / (implied) | §2.20 "Breakdown: Rewards + Refunds (**no cashback**)" | **Two tiles: Rewards + Refunds.** Cashback is removed from the whole product — no tile, no source, no string. |
| 2 | Help centre footer "Our team is here 9am–9pm, every day." | §2.21 Help Centre "**No support hours displayed**" | Omit the hours line entirely. |
| 3 | Review text labelled "(optional)", placeholder "Share what you liked…" | §2.24 "Review text (**required**)" | Required, min 10 chars, block submit until met. |
| 4 | Return reasons: 3 options | §2.18 lists **4**: Item damaged/defective, Wrong item delivered, No longer needed, **Quality not as expected** | All four radio options. |
| 5 | Request id `#RT-3391` | Batch-4 brief: `#RP-XXXX` | `#RP-` + 4-digit zero-padded counter. |
| 6 | Invoice tax as one line `TAX (5%)` | §2.19 + Part 7: "Tax (**CGST, SGST**)" | Split CGST and SGST rows. |
| 7 | Orders title "Orders and Returns"; a card reads "Cash on Delivery" | §2.17 "My Orders"; COD is removed from the product | Title "My Orders". **Never render a COD payment method.** |
| 8 | Affiliate dashboard "TOTAL EARNINGS ₹1,240.50" = pending + confirmed, plus "+₹180.00 this month" | §2.22 "total earnings, pending, confirmed, referrals" | Show all four stats. There is **no month-to-date field** in the schema — do not invent "this month". |
| 9 | Withdraw screen "Payout in 2–3 business days" | §2.22 "Admin manually approves + transfers **outside system**" | No SLA copy. The store has not promised a payout window. |
| 10 | Edit profile includes "Friend's code (optional)" | Friend's code is captured **at signup** (`friendCode`, spec 4.9) | Do not make it editable post-signup — it decides referral attribution and is server-consumed once. Ask before adding. |
| 11 | Add-money quick pills `₹100 / ₹500 / ₹1,000 / ₹2,000` | §2.20 silent on values, says "**no min/max**" | Spec is silent → **follow the prototype's four values.** (The Batch-4 brief's ₹500/₹1,000/₹2,000/₹5,000 has no source — prototype wins where the spec says nothing.) |
| 12 | Tracking timeline shows 4 visible steps | §2.17 Order Tracking: **6** steps Pending → Accepted → Packed → Shipped → Out for delivery → Delivered | All six. |

---

## 5. Shared visual tokens

Pulled from the design-system variables inlined in the standalone file
(`_ds/ecom-barakath-4730b472…/tokens/*.css`). **All of these now exist in code** — see §6.

### Colour

| Token | Hex | Meaning |
|---|---|---|
| `brand-primary` | `#0F7A5A` | brand green — links, selected states, success ticks |
| `brand-primary-dark` | `#166534` | avatar / deep green |
| `brand-primary-subtle` | `#E9F4EF` | green tint fills |
| `brand-gold` | `#DAA227` | **CTA fill** (black label on it) |
| `brand-gold-strong` | `#B8881F` | prices, active bottom-nav tab |
| `brand-gold-subtle` | `#FBF4DD` | gold tint card (spin reward, applied coupon) |
| `brand-gold-border` | `#E8D28A` | gold card border |
| `badge-gold-text` | `#8A6410` | text on gold-subtle badges |
| `success` | `#16A34A` | "Free", credit amounts, delivered |
| `success-strong` | `#1FC16B` | success emphasis |
| `warning` | `#FFDB43` | warning fills |
| `neutral-25` | `#FCFCFB` | app background |
| `neutral-0` | `#FFFFFF` | card surface |
| `neutral-50` | `#F8F8F8` | subtle surface |
| `neutral-200` | `#ECECEC` | **hairline / default border** |
| `neutral-300` | `#E5E5E5` | stronger border |
| `neutral-500` | `#9EA2AD` | tertiary text |
| `neutral-600` | `#7F7F7F` | secondary text |
| `neutral-900` | `#1F1F1F` | primary text |

Debit amounts render red — reuse the existing `AppColors.statusError` `#FB3748`.

### Type — Manrope throughout (already the app's `GoogleFonts.manrope`)

| Role | Size | Weight |
|---|---|---|
| display | 40 | 800 |
| h1 | 34 | 800 |
| h2 | 26 | 800 |
| h3 | 22 | 800 |
| title | 18 | 700 |
| body-lg | 16 | 600 |
| body | 14 | 400–700 |
| label | 13 | 400–700 |
| caption | 12 | 400 |
| micro | 11 | 500–700 |

Screen titles are 24/800 with `letter-spacing: -0.48px`. Section headers 15/800.
All-caps labels ("NORMAL WALLET BALANCE") are 11–12/800 with ~0.3–0.6px tracking.

### Radius

`xs 4` · `sm 6` · `md 8` · `lg 12` · `xl 16` · `pill 9999`

Cards are **12**. Buttons and inputs are **8**. Chips/badges/steppers are **pill**.

### Elevation

| Token | Value |
|---|---|
| `xs` | `0 1px 2px rgba(95,74,46,.06)` |
| `sm` | `0 2px 4px rgba(27,28,29,.04), 0 1px 2px rgba(95,74,46,.04)` |
| `md` | `0 6px 16px rgba(95,74,46,.08), 0 1px 2px rgba(95,74,46,.04)` |
| `lg` | `0 16px 40px rgba(95,74,46,.12)` |

Content cards are **flat with a 1px `#ECECEC` border**, not shadowed. Shadow is reserved for the
bottom-nav (`0 -6px 8px rgba(95,74,46,.05)`) and sheets.

### Spacing

4-based: `4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24`.
Screen horizontal padding **20**. Card inner padding **13–17** (use **14**). Gap between stacked
cards **12**. Section-to-section **20**.

### Components

- **Button** — h 46–52, radius 8, label 16/600. Primary = gold fill + black label. Secondary =
  white fill + `#ECECEC` border + black label. Both full-width in a bordered bottom bar
  (`padding: 15px 20px 16px`, 1px top border).
- **Badge / pill** — `padding: 4px 8px`, radius pill, 10–11/800, often uppercase. Status colours:
  green = delivered/confirmed/approved, gold = pending/active, red = cancelled/rejected,
  grey = used/expired.
- **Chip (filter/tab)** — `padding: 5px 11px`, radius pill, 13/700; selected = brand-green fill +
  white text, unselected = white + hairline border.
- **Stepper** — pill, 1px hairline border, `padding: 5px 11px`, 14/800 value.
- **List tile** — 72px square thumbnail at radius 8, 12px gap, title 14/700, subtitle 12/400 secondary.
- **Timeline** — filled dot + brand-green connector for done, hollow grey for pending; label 14/700,
  timestamp 12/400 secondary.
- **Empty state** — message only, **no action button** (spec §2.25). Non-negotiable.

---

## 6. What the foundation already put in code

| Token group | Where |
|---|---|
| Colours | `lib/core/constants/app_colors.dart` — every token above, named as in the table |
| Radii / spacing / elevation / durations | `lib/core/constants/app_dimens.dart` **(new)** |
| Text styles | `lib/core/theme/app_theme.dart` — `AppTheme.light.textTheme` |
| Status colour map | `lib/core/widgets/status_badge.dart` — `StatusBadge.forStatus()` |

Use `AppDimens.radiusCard`, `AppDimens.gapCards`, `AppDimens.screenPadding` etc. rather than raw
numbers, so a design change is one edit.
