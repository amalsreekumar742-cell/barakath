# Handoff: BARAKATH — E-commerce Ecosystem (Mobile App · Website · Admin Panel)

> **Read this first.** This document is a complete, self-sufficient implementation brief. A developer who was never part of the design conversation should be able to build the full product from this README alone. Hand this entire folder to Claude Code and point it at `PROMPT.md` to begin.

---

## Overview

BARAKATH is a **premium multi-category e-commerce ecosystem** (perfumes, books, clothing, Islamic products) built as **three connected products that share one backend and one design language**:

1. **Customer Mobile App** (37 screens) — the primary shopping experience, designed for Flutter.
2. **Customer Website** (35 screens) — the desktop/tablet extension of the mobile app.
3. **Enterprise Admin Panel** (47 screens) — operational control center (catalogue, orders, customers, payments, refunds, spinner campaigns, coupons, affiliate program, banners, notifications, reports, settings, sub-admins).

The product must feel **premium, minimal, modern, fast, trustworthy, enterprise-ready**. Currency is **₹ INR** everywhere.

---

## About the Design Files

The `.dc.html` files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look and behavior. **They are NOT production code to copy directly.**

Your task is to **recreate these designs in the target codebase's environment**, using its established patterns and libraries:
- **Mobile app** → the brief specifies **Flutter**. Recreate the screens as Flutter widgets with the codebase's state management (Bloc/Riverpod/Provider — follow whatever exists).
- **Website** → recreate in the web framework in use (React/Next, Vue, etc.). If none exists, **React + a component library that supports the tokens below** is the recommended choice.
- **Admin panel** → recreate as a web app (React/Next recommended). Use a real data-table/charting library.

If no environment exists yet, choose the most appropriate framework per platform and implement there. **Do not ship the HTML directly.**

---

## Fidelity

**High-fidelity (hifi).** These are pixel-level mockups with final colors, typography, spacing, radii, shadows, and interaction flows. Recreate the UI faithfully using the target codebase's libraries. All design tokens are enumerated in the **Design Tokens** section below and come from the bound **Barakath Design System** (see `_ds/` in the project).

---

## Design System (source of truth for all visuals)

The whole product is built on the **Barakath Design System** — a warm, earthy, premium system. Everything visual derives from its tokens. The full token CSS lives in the bundle under `_ds/ecom-barakath-.../tokens/` (`colors.css`, `scale.css`, `fonts.css`, `fig-tokens.css`).

### Brand personality
Playful but professional. Second person, present tense. Sentence case for almost everything (UPPERCASE only for tiny tracked eyebrow labels). No emoji. Prices/numerics set in the brand font, prices use the gold-strong color.

### Color
| Token | Value | Use |
|---|---|---|
| Brand primary (evergreen) | `rgb(15,122,90)` / `#0F7A5A` | CTAs, links, active states, primary icons |
| Brand primary dark | darker evergreen | gradients, hover fills |
| Brand primary subtle | pale green tint | active nav backgrounds, chips |
| Brand gold | `rgb(218,162,39)` / `#DAA227` | signature accent, ratings |
| Brand gold strong | deeper gold | **prices**, premium/affiliate tags, withdraw CTA |
| Brand gold subtle | pale gold tint | reward/affiliate banners |
| App background | `rgb(252,252,251)` / `#FCFCFB` | app surface |
| Card surface | pure white | cards (dominant surface) |
| Border subtle | `rgb(236,236,236)` / `#ECECEC` | hairline borders |
| Text primary / secondary / tertiary | near-black / mid / light gray | text hierarchy |
| Success | green | delivered, paid, in-stock |
| Warning | gold | packing, COD, low-stock |
| Error | red | cancelled, failed, out-of-stock, delete |
| Info | blue | shipped, out-for-delivery, automated |

Status pills use a subtle-tinted background + strong foreground of the matching status color, radius 6, `font:700 11px`.

### Typography
One brand typeface — **Manrope** (Google Fonts), weights 400/500/600/700/800.
- Display / headings: 700–800, tight tracking (`letter-spacing:-0.02em`), sizes 40 → 24.
- UI + body: 400/600, 14px base.
- Micro labels & numerics: 11px, tracked +0.04–0.06em when uppercase.
- Two named roles used in markup: `var(--font-display)` (headings/prices) and `var(--font-ui)` (everything else).

### Spacing
`2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48` px. Cards pad 20–24, list rows 12, controls 8–20 by size.

### Radius
`4 / 6 / 8 (controls) / 12 / 16 (cards) / pill (chips, avatars, search)`. Roundness is core to the feel.

### Elevation
Soft, **warm-tinted** shadows (`rgba(95,74,46,·)`) — never harsh black. `sm` on resting cards, `md/lg` on raised surfaces. Many surfaces use a hairline border instead of a shadow.

### Motion
Quiet & quick — 120–200ms, ease `cubic-bezier(.4,0,.2,1)`. Buttons darken on hover, nudge down ~0.5px + scale 0.99 on press. No bounces, no infinite loops.

### Components (from the design system)
Button (primary/gold/neutral/error · solid/outline/ghost/link · s/m/l), Chip (soft/solid/outline; brand/gold/status tones), Avatar, StatusBadge, InfoBar, ProgressStep, Pagination, TestimonialCard, and the **Barakath Icon set** (line/fill glyphs rendered via an `Icon` component, `currentColor`). Recreate equivalents with the target codebase's component library; keep geometry and states.

### Iconography note
The HTML prototypes use the design system's materialized icon set (44 glyphs). In a real build, use a full icon library (e.g. Remix Icon, which this set is based on) so every glyph is available. Icons paint with `currentColor`.

---

## PLATFORM 1 — Customer Mobile App (Flutter)

**Frame size:** 390×844 (iPhone-class). Min text 12px, hit targets ≥44px.

**Bottom navigation (exactly 5, do not change):** Home · Category · Bag · Wallet · Profile.

### Screen inventory & flow
1. **Authentication** — Splash (logo micro-animation, white bg) → 3 Onboarding slides → **Enter mobile number** → **OTP verification (6-digit)** → **Create profile** (Display name, WhatsApp number, Friend's code (optional), Email — with a **Skip** option) → Home. *(Auth is mobile-number based; no password.)*
2. **Home** — brand logo header, search, **premium ad banner (top)**, flash sale, new arrivals, best sellers, and horizontal-scrolling rows for **all 4 categories**, offer banner, recently viewed.
3. **Category** — categories, sub-categories, product grid, filters (bottom sheet), sorting.
4. **Product** — image gallery, variants, pricing, **referral price**, stock status, description, specifications, ratings & reviews, related products, frequently-bought-together, wishlist, share, add-to-bag. *(All sections under the image share 16px side padding and 16px vertical rhythm; product image is compact, not full-bleed.)*
5. **Shopping** — Bag → **Apply coupon** + **Apply spin reward** → Address selection → Add address → Checkout → Razorpay payment → Order success.
6. **Orders** — list, detail, tracking timeline, invoice, cancel request, return request, reorder.
7. **Wallet** — **Normal wallet** (balance, rewards, refunds, cashback, transaction history, with "how to add money" flow) and **Affiliate wallet** (earnings, pending/confirmed commission, referral link/code, withdraw, withdrawal history). **Affiliate wallet is visible ONLY to admin-allocated affiliate users — hide entirely for normal customers.**
8. **Rewards** — Spin & Win (wheel with offers: ₹10 off / 15% off / ₹50 cashback / ₹100 off / better luck), reward result, coupon wallet (active/used/expired).
9. **Affiliate dashboard** — total earnings card, pending/confirmed, referral code + share, recent commission. (Allocated users only.)
10. **Notifications**, **Support** (Call · WhatsApp · Email only), **Profile** (personal info, saved addresses, payment history, privacy policy, terms, **logout with confirm popup**).
11. **Complete-withdrawal** UI + **Add bank account** screen (affiliate).

**Nav/UI accents:** gold nav bar and gold primary buttons where specified; splash is white.

### Prototype files
- `Barakath Customer App.dc.html` — the screen board (all screens laid out with captions).
- `Barakath Prototype.dc.html` — the **clickable** prototype (screen-to-screen navigation).
- `Barakath Prototype Offline.dc.html` / `Barakath Prototype.html` — standalone builds.
- `ProductCard.dc.html`, `TabBar.dc.html` — reusable components.

---

## PLATFORM 2 — Customer Website

**Frame size:** 1512×862 (desktop). Must be responsive down to tablet. Full parity with the mobile app — **all screens present**, adapted to desktop layout.

### Structure
- **Global header:** logo (→home), search (→search), **category icon on the right that opens a categories flyout**, wallet, profile, bag. *(Category lists and "offers" were removed from the menu bar; categories live behind the category icon.)* Footer Account column: Orders · Wallet · Profile (no wishlist — wishlist was removed product-wide).
- **Account area** with a left rail: My orders · Wallet · **Affiliate wallet** · Saved addresses · Notifications · Settings · Log out (→ confirm modal).
- **Home** shows flash sales, new arrivals, and all categories like the mobile app.
- **Shopping:** listing, product detail (large gallery, zoom, variants, specs, reviews, related, FBT, share, add-to-bag), search results, bag (with **spin-reward row + "Apply a coupon" row**, mobile-style), checkout (**Apply coupon** block above payment), Razorpay, order success.
- **Wallet / Affiliate / Rewards / Orders / Notifications / Support / Profile** — mirror the mobile app, including the Affiliate dashboard (TOTAL EARNINGS gradient card, pending/confirmed/referrals, recent commission, referral code + share, "Open Affiliate Wallet"), Complete-withdrawal, Add-bank, Saved-addresses, Register.

### 35 screens (ids used in the prototype)
home, listing, product, bag, checkout, success, signin, account, normalWallet, affiliateWallet, spin, search, categories, createProfile, coupons, address, addAddress, payment, orderDetail, tracking, invoice, returnReq, affiliateDash, referral, addBank, rewardResult, couponWallet, notifications, support, personalInfo, settings, register, savedAddr, completeWithdraw, logout.

### Prototype files
- `Barakath Website.dc.html` — screen board.
- `Barakath Website Prototype.dc.html` — clickable prototype (header, product cards, list rows, CTAs, tabs all navigate).
- `Barakath Website Full Screens.dc.html` — flattened, images inlined, 1512px frames (used for Figma export).

---

## PLATFORM 3 — Enterprise Admin Panel

**Frame size:** 1440×900. Enterprise density (compact rows, 8–12px radii on tables/controls). Persistent left sidebar (14 modules, grouped) + top bar (global search + profile — **no notification bell**) + breadcrumb + workspace.

### Sidebar modules (grouped)
- **Catalogue:** Products, Categories, Inventory
- **Operations:** Orders, Customers, Payments, Refunds
- **Growth:** Spinner Campaigns, Coupons, Affiliate Program, Banner, Notifications
- **Insights:** Reports & Analytics, Settings, Sub Admin
- (Dashboard sits above the groups.)

### 47 screens & key behaviors
- **Dashboard** — KPIs (today's revenue, orders, pending, AOV), revenue trend chart, category performance, recent orders, low-stock alerts.
- **Products** — list with **sub-category column** + Filters inner page; **Add product**: name, category, sub-category, description; **per-variant pricing** table (each Color×Unit row has Price / Offer / Referral / Commission) with **inline add-variant row** and per-row delete; **Add variant** inner screen (Color select, Group select, Unit select within group, + the 4 amount fields); **Specifications** as repeatable key:value fields; **Frequently bought together** with an **Attach product** picker screen. *(No publish/visibility status card.)*
- **Categories** — list with **delete** (→ confirm dialog); **Add category** = image + name only, with **inline sub-category create** on the same screen; **Sub-categories** screen with per-row delete.
- **Inventory** — stock levels, low/out-of-stock, adjustments.
- **Orders** — list with status tabs; **Order detail** with a **working Update-status dropdown**. Statuses: **Accepted · Packed · Shipped · Delivered · Cancelled**. Timeline + AWB.
- **Customers** — list with **affiliate enable toggle**; **Customer profile** with **3 tabs: Orders · Wallet · Affiliate wallet** (order history rows click through to order detail; both wallets shown as transaction tables; affiliate toggle + referral code).
- **Payments** — transactions, gateway (Razorpay), status.
- **Refunds** — Pending / Approved / Rejected screens; **approve → confirmation dialog** (credit to Normal wallet or original method).
- **Spinner Campaigns** — list (cards with per-card delete); **Create campaign** inner page; **Campaign detail** with a **wheel-offer builder** (each offer: type **₹ / % / ==** + text) and **per-segment usage %**; per-offer delete.
- **Coupons** — list with delete; **Create coupon** inner page (code, discount type, value, max discount, min cart, usage limit, expiry, target users, category restriction).
- **Affiliate Program** — dashboard (active affiliates, pending/confirmed commission, withdrawals to approve); withdrawal **Approve → confirm dialog**; **Allocate affiliate** inner page (search customer, referral code, commission rate, enable wallet).
- **Banner** (renamed from CMS) — multiple banners, **16:9 aspect ratio** stated, **attach product**; **Add banner** inner page; per-banner delete.
- **Notifications** — list with delete; **Create notification** inner page (title, message, audience, deep link, schedule) + preview; **Send → confirm dialog**.
- **Reports & Analytics** — KPIs, revenue-by-month chart, top products, export PDF/Excel, date range.
- **Settings** — tabs: **Variables** (Color = direct units with swatches; Variant groups = named groups holding units, e.g. Size › S/M/L/XL, Material › Cotton/Linen/Silk; per-group delete; **Create variant** + **Create units** inner screens), **Delivery & tax**, **Payment gateway**, **Privacy policy** (rich-text), **Terms & conditions** (rich-text).
- **Sub Admin** — list; **Create sub admin** inner page (name, email, phone, role, **password**, **individual per-module permission matrix** of toggles); **Create → confirm dialog**.
- **Confirmation dialogs** everywhere a destructive/irreversible action occurs (delete, approve, send, create admin) — a generic "Delete this item?" modal covers the delete affordances.

### Prototype files
- `Barakath Admin Panel.dc.html` — screen board (47 screens, captioned).
- `Barakath Admin Prototype.dc.html` — clickable prototype (sidebar nav, table-row drill-downs, tabs, working status dropdown, delete/confirm dialogs).

---

## Business rules (must be enforced in the build)

- **Two independent wallets, never mixed.** Normal wallet (refunds, promo rewards, spin rewards, cashback). Affiliate wallet (affiliate earnings, commission tracking, withdrawals) — **only admin-allocated users** ever see affiliate features (dashboard, wallet, referral link/code, commission reports, withdraw). Normal customers must never see them.
- **Affiliate access is admin-controlled** (toggle on the customer in the admin panel).
- **Spinner:** won rewards become redeemable coupons with expiry; apply at checkout; expired coupons never redeemable.
- **Coupons:** validate eligibility (min cart, max discount, expiry, usage limit, target users, category restriction) before applying.
- **Checkout:** minimum effort — saved addresses, coupon, wallet, online payment (Razorpay), COD where available, confirmation, invoice.
- **Product variants:** per-variant Price / Offer price / Referral price / Commission. Variants generated from Color × Variant-group units.

---

## State management (per platform)

- **Auth/session:** current user, affiliate-allocated flag (gates all affiliate UI), OTP flow state.
- **Catalogue:** categories/sub-categories, products, variants, filters, sort.
- **Cart/checkout:** line items (with chosen variant), applied coupon, applied spin reward, selected address, payment method, totals.
- **Wallets:** normal balance + transactions, affiliate balance + commission + withdrawals.
- **Orders:** list + detail + status timeline.
- **Admin:** table data (search/filter/sort/paginate), per-entity CRUD, dialog open/close, order status (the prototype's dropdown is real state), variables (colors + groups + units), per-admin permission matrix.

---

## Design Tokens (quick reference)

- **Colors:** primary `#0F7A5A`, gold `#DAA227`, app `#FCFCFB`, card `#FFFFFF`, border `#ECECEC`; status success/warning/error/info as above. Full set in `_ds/.../tokens/colors.css`.
- **Type:** Manrope 400/500/600/700/800; display sizes 40/32/26/24, body 14, micro 11.
- **Spacing:** 2/4/8/12/16/20/24/32/48.
- **Radius:** 4/6/8/12/16/pill.
- **Shadow:** warm-tinted `rgba(95,74,46,·)` sm/md/lg.
- **Motion:** 120–200ms, `cubic-bezier(.4,0,.2,1)`.

---

## Assets

- **Logo:** `images/logo.png` (in the bundle).
- **Product/category imagery:** warm gradient/photo placeholders in `images/` (`perfume.png`, `book.png`, `clothing.png`, `islamic.png`) — **swap for real photography** in production.
- **Design-system tokens & components:** `_ds/ecom-barakath-4730b472-.../` (colors, scale, fonts, styles, component bundle).
- **Icons:** Barakath icon set (Remix-Icon-based); use a full icon library in the real build.

---

## Files in this bundle

- `Barakath Customer App.dc.html`, `Barakath Prototype.dc.html` — mobile board + prototype.
- `Barakath Website.dc.html`, `Barakath Website Prototype.dc.html` — website board + prototype.
- `Barakath Admin Panel.dc.html`, `Barakath Admin Prototype.dc.html` — admin board + prototype.
- `ProductCard.dc.html`, `TabBar.dc.html` — shared components.
- `PROMPT.md` — the ready-to-paste Claude Code prompt.
- `_ds/`, `images/` — design tokens and assets referenced by the files above.

> To view any `.dc.html`, open it in a browser (they are self-contained design prototypes). Use them as the visual spec; implement in the real codebase per the guidance above.
