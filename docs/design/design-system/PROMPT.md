# Claude Code Prompt — Build BARAKATH

Paste this into Claude Code (with this folder open) to begin implementation.

---

You are implementing **BARAKATH**, a premium multi-category e-commerce ecosystem (perfumes, books, clothing, Islamic products) with three connected products that share one backend and one design language:

1. **Customer Mobile App** — build in **Flutter**.
2. **Customer Website** — build in **React (Next.js)** unless a web framework already exists in this repo; if one exists, use it.
3. **Enterprise Admin Panel** — build as a **React (Next.js)** web app with a real data-table + charting library.

## Ground rules

- **`README.md` in this folder is the complete spec.** Read it fully before writing code. It enumerates every screen, behavior, business rule, and design token.
- The `.dc.html` files are **design references** (HTML prototypes) — recreate their look and behavior in the real codebase using its existing patterns and libraries. **Do not copy the HTML into production.**
- **Fidelity is high** — match colors, typography (Manrope), spacing, radii, shadows, and interactions precisely, using the tokens in the README (and `_ds/.../tokens/` for exact values).
- Currency is **₹ INR** everywhere.

## Enforce these business rules
- **Two wallets, never mixed:** Normal wallet vs Affiliate wallet. Affiliate features (dashboard, wallet, referral link/code, commission, withdraw) are visible **only to admin-allocated affiliate users** — gate them behind an `isAffiliate` flag; normal customers never see them.
- Affiliate allocation is controlled from the admin panel (toggle on the customer).
- Spinner rewards become redeemable coupons with expiry; validate coupon eligibility (min cart, max discount, expiry, usage limit, target users, category) before applying; expired coupons are never redeemable.
- Product variants carry per-variant **Price / Offer / Referral / Commission**, generated from Color × Variant-group units.
- Checkout: saved addresses, coupon, spin reward, wallet, Razorpay, COD where available, confirmation + invoice.

## Suggested build order
1. Set up the **design tokens** (colors, Manrope type scale, spacing, radii, shadows) as the theme in each app.
2. Build **shared UI primitives** (Button, Chip, Card, Avatar, StatusPill, Icon wrapper, DataTable, Dialog).
3. **Mobile app:** auth (mobile-number + 6-digit OTP + create-profile/skip) → home → category → product → bag/checkout → orders → wallets → rewards → profile. Bottom nav: Home · Category · Bag · Wallet · Profile.
4. **Website:** mirror the mobile app for desktop (1512-wide, responsive to tablet), header with category flyout, account area with left rail incl. Affiliate wallet.
5. **Admin panel:** sidebar + topbar shell → Products (per-variant pricing, add-variant, specs, FBT attach) → Categories → Inventory → Orders (status dropdown: Accepted/Packed/Shipped/Delivered/Cancelled) → Customers (3-tab profile) → Payments → Refunds → Spinner (wheel-offer builder + usage %) → Coupons → Affiliate → Banner (16:9, attach product) → Notifications → Reports → Settings (Variables/Delivery&tax/Gateway/Privacy/Terms) → Sub Admin (password + per-module permission matrix). Confirmation dialogs for all destructive/irreversible actions.

Start by reading `README.md`, then confirm the target frameworks (or detect them from the repo), then scaffold the theme and shared components before building screens. Ask me before making irreversible architectural choices.
