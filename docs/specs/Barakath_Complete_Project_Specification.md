# Barakath — Complete Project Specification

## Project Overview

**Barakath** is an Islamic ecommerce platform selling Perfumes, Books, Clothing, and Islamic products. The project consists of three frontend modules backed by Firebase.

### Tech Stack

| Module | Technology |
|--------|-----------|
| Admin Panel | React + Vite |
| User App | Flutter |
| Website | Next.js |
| Backend | Firebase (Firestore, Auth, Storage, Cloud Functions, FCM) |
| Payment Gateway | Razorpay (only) |
| OTP Provider | MSG91 |
| Currency | ₹ (INR) |
| Language | English only |

### Design Assets
- All UI screens designed in Figma
- Assets (icons, illustrations, logos) exported from Figma and used in all modules
- Admin: `/src/assets/` (SVG, PNG, WebP)
- App: `/assets/` (SVG, PNG, WebP)
- Website: `/public/assets/` (SVG, PNG, WebP)

---

# PART 1: ADMIN PANEL (React + Vite)

## 1.1 Authentication

- Login with email + password (Firebase Auth)
- Forgot password → email reset link → reset password page → redirect to login with success toast
- On success, redirect to Dashboard
- Logout button on top bar (header area) next to admin profile badge
- Logout with confirmation dialog

## 1.2 Sidebar Navigation

- **Dashboard** (standalone, not under any group)
- **CATALOGUE**: Products, Categories, Inventory
- **OPERATIONS**: Orders, Customers, Payments, Replacement, Reviews
- **GROWTH**: Spinner Campaigns, Coupons, Affiliate Program, Banner, Flash Sale, New Arrivals, Notifications
- **INSIGHTS**: Reports & Analytics, Settings, Sub Admin

## 1.3 Dashboard

- Live overview with current date
- Summary cards with trend % indicators:
  - Today's revenue (▲/▼ vs yesterday)
  - Total orders (▲/▼ this week)
  - Pending orders ("needs action" alert)
  - Avg order value (▲/▼ this month)
- Revenue trend bar chart with 12M / 30D / 7D toggle
- Category performance horizontal bars with percentages
- Recent orders mini table (Order ID, Customer, Status, Total)
- Low stock alerts with remaining count

## 1.4 Categories

### Listing Page
- Count summary (e.g. "4 top-level · 18 sub-categories")
- "+ Add category" button
- Table columns: Category (image + name), Sub-categories (dot-separated), Products count
- Actions per row: Edit button, Delete (×)
- No drag reorder, no visibility/status toggle
- Lazy loading with "Load More" button
- Deletion blocked if category has products → toast: "Delete products first"
- Delete confirmation dialog (irreversible, removes all sub-categories)
- Confirmation dialog + toast on add/delete

### Add/Edit Category
- Category image upload (max 2MB, JPG/PNG/WebP)
- Category name (no description field)
- Sub-categories: input + Add button, displayed as removable chips

### Sub-categories Detail Page
- Table: Sub-category name, Products count
- Actions: Delete (×)
- No slug, no status/visibility
- "+ Add sub-category" button

## 1.5 Products

### Listing Page
- Count summary (e.g. "248 products · 4 categories")
- "+ Add product" button (Import removed)
- Search field, Filters button, Export (CSV)
- Table columns: Product (thumbnail + name), SKU (admin-entered), Category, Sub-category, Price (₹), Stock, Status (Active/Low stock/Out of stock/Archived)
- Actions per row: Edit icon, Delete (×) — hard delete from Firebase
- No drag reorder
- Pagination with page numbers

### Filters Panel
- Category (pill buttons)
- Sub-category (filtered by selected category)
- Stock status: All, In stock, Low stock, Out of stock
- Product status: All, Active, Archived
- Price range: Min/Max input fields
- Reset and Apply filters buttons

### Add/Edit Product
- **Details section:**
  - Product name
  - SKU (admin-entered, unique)
  - Category dropdown
  - Sub-category dropdown (filtered by category)
  - Description (rich text editor — normal, not React Quill)
- **Images section (right side):**
  - Multiple image upload, max 5 images
  - Max 2MB each, JPG/PNG/WebP
  - First image = hero, rest = thumbnails
  - "+" button to add more
- **Product video:**
  - YouTube video link field (optional)
- **Options section:**
  - Combo product toggle ("Bundle of items sold together")
  - Combo delivery charge (₹) — shown only when combo = true
- **Replacement available toggle** — per product
- **Low stock threshold field** — per product
- **Status** — Active/Archived toggle (on edit page)
- **Variants & pricing section:**
  - Select variant types from Settings (Color, Size etc.)
  - "+ Add variant" opens Add Variant page
  - Table columns: Color (swatch), Size, MRP, Offer, Referral, Commission, Stock, × delete
  - Minimum 1 variant required
  - Validation: MRP > Offer > Referral > Commission
  - Each variant added one at a time via separate form
  - New units can be created on the fly (auto-saved to Settings > Variables)
- **Specifications section:**
  - Dynamic key-value fields, max 10
  - "+ Add field" button, × to remove
- **Frequently bought together:**
  - Only shown when combo = true
  - "+ Attach product" → reusable product picker
  - Max 10 linked products
  - Shows thumbnail + name + price, × to remove

### Add Variant Page
- Attributes: Color (select), Group (select), Unit (select)
- "Add new variant / unit" — create on the fly, auto-saved to Settings
- Pricing & stock: MRP (₹), Offer price (₹), Referral price (₹), Commission (₹), Stock
- Cancel + "Add variant" buttons

### Reusable Product Picker
- Used across: Frequently bought together, Flash Sale, New Arrivals, Banner product attachment
- Search field to filter products
- Product list: thumbnail, name, category · price, checkbox (multi-select)
- Dynamic button: "Add/Attach [n] products"
- Cancel button

## 1.6 Inventory

### Listing Page
- Summary subtitle (e.g. "Stock levels across 248 products")
- "Adjust stock" button + "Export" button (CSV)
- Summary cards: In stock count, Low stock count, Out of stock count, Total SKUs
- Table: Product name, SKU (variant-specific), Variant (e.g. Green · M), In stock qty, Status (In stock/Low/Out), Updated (relative time)
- No drag reorder
- Pagination

### Stock Status Auto-Calculation
- Stock > low stock threshold → In stock
- Stock ≤ threshold and > 0 → Low
- Stock = 0 → Out

### Adjust Stock Page
- Table: Product + variant, SKU, In stock, Adjust (− / + buttons)
- Right panel: Reason (required text), Reference/note (optional)
- Multiple SKUs adjusted in one batch
- Stock blocked at 0 (cannot go negative)
- All adjustments logged to stockAdjustments collection
- Confirmation dialog + toast on save

## 1.7 Orders

### Listing Page
- Count summary (e.g. "1,248 orders · 36 pending")
- Export (CSV)
- Filter tabs: All, Pending, Accepted, Packed, Shipped, Delivered, Cancelled
- Table: Order ID (#BRK-XXXXX), Customer, Items count, Payment status (Paid/Failed), Order status, Total (₹)
- No drag reorder
- Pagination

### Order Detail Page
- Title with order ID
- "Update status" button — step by step progression (manual)
- "Invoice" button — only when status = Delivered
- Items list: thumbnail, name, variant, qty, price
- Shipment/AWB: Courier, AWB number, Rider, ETA
- Timeline: vertical progress with status + date/time at each stage
- Customer info: name, delivery address, phone

### Order Flow
- Pending → Accepted → Packed → Shipped → Out for delivery → Delivered
- Admin manually advances status step by step
- Cancel only at Pending stage
- Cancelled order auto-refunds to same gateway used to pay
- FCM notification sent at each status change
- Stock deducted on order placement
- Status change dates stored (pendingAt, acceptedAt, packedAt, etc.)
- Order ID: auto-incrementing #BRK-XXXXX format

### Dual Courier Implementation
- **Manual mode (current):** Admin manually updates all statuses
- **API mode (future — Shadowfax):** After admin marks "Packed", courier API takes over. Webhook auto-updates statuses.
- Switchable via Settings (`courierMode: "manual" | "api"`)

## 1.8 Customers

### Listing Page
- Count summary (e.g. "8,420 registered · 128 affiliates")
- Export (CSV), Search
- Table: Customer name, Phone, Orders count, Wallet (₹), Affiliate toggle, Status (Active/Blocked)
- No drag reorder
- Pagination
- Customers are blocked, not deleted

### Customer Detail Page
- Profile info: avatar, name, member since, phone, email
- Affiliate marketing toggle + referral code
- Block/Unblock button (same button toggles)
- Export data button (CSV)
- **Orders tab:** Order history (Order ID, Date, Items, Status, Total)
- **Wallet tab:** Normal wallet balance + transaction history (Type, Source, Date, Amount)
- **Affiliate wallet tab:** Affiliate balance + commission/withdrawal history

### Add Money to Wallet Popup (Admin)
- Title: "Add money to wallet"
- Shows customer name + current balance
- Amount field + quick pills (₹100, ₹500, ₹1,000, ₹2,000)
- Reason field (required, e.g. "Goodwill credit")
- Cancel + "Add ₹[amount]" buttons

## 1.9 Payments

### Listing Page
- Summary subtitle (e.g. "₹48.2L this month · 12 failed")
- Export (CSV) — GST invoices button removed
- Table: TXN ID (pay_XXXXX or wal_XXXXX), Order ID, Method (UPI/Card/Netbanking/Wallet), Gateway (Razorpay or —), Status (Success/Failed/Pending), Amount (₹)
- No drag reorder
- Pagination
- Click payment row → Tax Invoice dialog

### Tax Invoice Dialog
- Modal overlay
- Header: Tax Invoice + Order ID + Transaction ID + Close (×)
- Business info: name, GSTIN, address
- Customer billing info: name, mobile, address
- Line items: product, qty, unit price, total
- Tax breakdown: Taxable value, CGST, SGST, Grand Total
- Download PDF button

## 1.10 Replacement Requests

### Listing Page
- Sidebar label: "Replacement" (not "Refunds")
- Breadcrumb: "Operations > Replacement"
- Summary subtitle (e.g. "14 pending · 42 approved · 6 rejected")
- Export (CSV)
- Filter tabs: Pending, Approved, Rejected
- **Pending table:** Request ID (#RP-XXXX), Order ID, Customer, Product, Reason, Photo (thumbnail + "View"), Actions: Approve/Reject
- **Approved table:** Same columns + "Approved" status label (green)
- **Rejected table:** Same columns + "Rejected" status label (red)
- Pagination

### Replacement Detail Page
- Title: "Replacement request · #RP-XXXX"
- "Reject" button (red outline) + "Accept replacement" button (green)
- Customer photos (multiple images uploaded by customer)
- Description text
- Request details: Product + variant, Order ID, Reason, Requested date
- Customer info: name, phone

### Replacement Rules
- Only products with "Replacement available" toggle ON can be requested
- Per product, not per order
- One replacement per product per order (check orderId + productId)
- Reasons: Item damaged/defective, Wrong item delivered, No longer needed, Quality not as expected
- Approved → replacement order auto-created (₹0 free order, same variant or different variant if out of stock)
- Rejected → admin enters reason in popup with text field
- Replacement order goes through same flow: Pending → Accepted → ... → Delivered
- Confirmation dialog + toast on approve/reject
- FCM notification to customer on approve/reject

## 1.11 Reviews

### Listing Page
- Sidebar: under OPERATIONS (after Replacement)
- Summary subtitle (e.g. "1,240 reviews · 4.7 avg rating")
- Filter tabs: All, Published, Hidden (Reported tab removed)
- Table: Customer (avatar + name), Product, Rating (stars), Review text, Date, Status (Published/Hidden)
- Actions: Eye icon (toggle publish/hide), × delete
- Pagination
- Hard delete from Firebase with confirmation + toast

### Rules
- Users write reviews after order Delivered
- One review per product per order
- New reviews auto-published (no moderation queue)
- Admin can hide or delete later
- Hidden reviews not shown on app or website
- Product averageRating recalculated from published reviews only

## 1.12 Coupons

### Listing Page
- Count summary, "+ Create coupon" button
- Table: Code, Type (₹ off/% off/Free shipping), Min cart, Max disc, Used count, Expiry, Status (Active/Expired)
- Actions: Edit button, × delete
- No drag reorder
- Expired coupons stay in list with "Expired" label
- Pagination

### Create/Edit Coupon
- Coupon code (uppercase only, no spaces, unique)
- Discount type dropdown (Fixed amount / Percentage / Free shipping)
- Discount value (not required for Free shipping)
- Max discount (cap for percentage)
- Min cart value
- Usage limit (total)
- Expiry date (date picker, or no expiry)
- Target users dropdown: All users / New users (createdAt within 30 days) / Affiliates
- Category restriction (multiple categories selectable)
- One use per user
- Editable after creation
- Hard delete with confirmation + toast

## 1.13 Spinner Campaigns

### Listing Page
- Summary subtitle, "+ Create campaign" button
- Campaign cards: name, status (Active/Scheduled), plays count, conversion %, × delete
- Hard delete with confirmation + toast

### Create Campaign
- Campaign name, Start/End date, Spins per user/day
- Eligibility dropdown: All users / New users / Affiliates
- Activate immediately toggle
- "Create & configure" button
- Cannot edit after creation — only pause or delete

### Configuration Page
- Wheel preview (visual spinner with segments, "SPIN" center, total plays count)
- Wheel offers: "+ Add offer"
  - Type toggles: ₹ (flat) / % (percentage) / == (fixed like free shipping)
  - Reward text
  - Usage progress bar
  - Probability % (all must total 100%)
  - × delete
- "Better luck next time" = discountValue 0
- "Pause" and "Save" buttons
- Rewards become coupons (auto-generated code), valid 3 days, one per order

## 1.14 Affiliate Program

### Listing Page
- Summary cards: Active affiliates, Pending commission, Confirmed, Withdrawals to approve
- Withdrawal requests table: Affiliate name, Code, Bank (name + last 4), Confirmed balance, Amount, Approve/Reject buttons
- "Allocate affiliate" button only (Reports removed)
- Approve → confirmation dialog showing amount, customer, bank
- Reject → returns amount to withdrawable balance
- Admin manually transfers money outside system, then marks as approved

### Allocate Affiliate Page
- Search customer (by name/phone)
- Referral code (auto-generated: first 4 chars of name + 4 random alphanumeric)
- Enable affiliate wallet access toggle
- Commission rate field and Wallet dropdown removed — commission is per-variant in product

### Affiliate Rules
- Commission = fixed ₹ per variant (from product variant table)
- 7-day clearing period — admin manually confirms (not auto)
- Minimum withdrawal: ₹10,000
- Max 2 bank accounts per affiliate
- Admin can disable affiliate by toggling off on customer detail page
- Referral link: barakath.com/r/[code]

## 1.15 Banners

### Listing Page
- Two separate sections: App Banner and Website Banner
- Each section shows recommended size:
  - App: 1080 × 608 (16:9)
  - Website: 1920 × 640 (3:1)
- Banner cards: image, title, status (Live/Draft), attached product, × delete
- Click card to edit
- Display order by creation date
- No drag reorder
- Draft banners: admin only, never shown to users

### Add/Edit Banner
- Placement selection: App / Website (locked after creation, cannot change)
- Banner image upload (dimensions update based on placement)
- Banner title
- Attach products (searchable dropdown, min 1, multiple products)
- Publish live toggle
- Cancel + Save buttons
- If attached product deleted → banner shows "Product not available", tapping does nothing
- Hard delete with confirmation + toast

### Banner Navigation
- Tapping a banner opens a product listing page showing all attached products
- URL: `/banner/[bannerId]`

## 1.16 Flash Sale

### Listing Page
- Table: Sale name, Products count, Discount, Window (date/time), On/Off toggle, × delete
- Ended sales stay with toggle off
- No edit after creation — only toggle on/off or delete

### Add Flash Sale
- Left: product picker with multi-select (min 2 products)
- Right: Sale name, Discount type (Percentage/Flat), Discount value, Start (date+time), End (date+time), Activate now toggle
- Cancel + "Create flash sale" button

### Flash Sale Rules
- Discount applies on original MRP of all variants of selected products
- Flash price must be lower than offer price
- Prices auto-revert when flash sale window ends
- Same product cannot be in multiple active flash sales
- Flash sale price shown as separate flash price on product cards (MRP strikethrough + flash price + discount %)
- "Flash sale" badge on product cards (both app and website)
- Countdown timer on home page
- During flash sale: offer price hidden, flash price + MRP shown
- After sale ends: reverts to offer price + MRP

## 1.17 New Arrivals

### Listing Page
- Subtitle: "Curated from existing products"
- "+ Add products" button (reusable product picker)
- Table: Product (thumbnail + name), Category, Added date, × remove button
- No status/visibility (removed)
- No drag reorder
- Removing doesn't delete the product — only removes from New Arrivals
- Managed via boolean flag `isNewArrival` on product document

## 1.18 Push Notifications

### Listing Page
- Summary subtitle, "+ Create notification" button
- Table: Title, Audience, Sent count, Opened count, Status (Sent/Automated/Scheduled)
- Actions: × delete
- No drag reorder
- Pagination
- Automated notifications also shown in listing

### Create Notification
- Title, Message
- Audience dropdown: All users / Order updates / Active 30d (createdAt within 30 days)
- Deep link dropdown: Home / Product / Category / Flash sale / Spinner
- Send: Now / Scheduled
- Schedule: date/time picker (when scheduled)
- Preview section (shows notification as it appears)
- Cancel + "Send / schedule" button
- Send confirmation dialog (irreversible, shows audience count)

### Automated FCM Notifications
| Event | Deep Link |
|-------|-----------|
| Order confirmed | Order detail |
| Order packed | Order detail |
| Order shipped | Order tracking |
| Out for delivery | Order tracking |
| Order delivered | Order detail |
| Order cancelled | Order detail |
| Replacement approved | Order detail |
| Replacement rejected | Order detail |
| Spin reward won | My coupons |
| Commission confirmed | Affiliate wallet |
| Wallet balance added | Wallet |

## 1.19 Reports & Analytics

- Date range selector (default: current month)
- Export PDF + Export Excel buttons
- Summary cards with trends: Total revenue (delivered orders only), Orders, New customers, Refund rate (cancelled orders)
- Trend comparison: current period vs previous equal period
- Revenue by month bar chart
- Top 5 products ranked list with revenue
- No additional charts

## 1.20 Sub Admin

### Listing Page
- Count summary, "+ Create admin" button
- Table: Admin name, Role (Super admin/Manager/Support), Last active (relative time), Status (Active/Suspended)
- Actions: × delete
- No drag reorder
- Status toggle to suspend/activate (confirmation dialog + toast)
- Super admin cannot delete or suspend another super admin
- Suspended admin: login blocked with message
- Pagination

### Create Sub Admin (via Cloud Function)
- Full name, Email, Password (min 8, 1 upper, 1 lower, 1 number, 1 special), Phone (+country code)
- Role dropdown: Super admin / Manager / Support
- Module permissions: individual toggles per sidebar module
- Role-based defaults:
  - Super admin: all ON
  - Manager: all ON except Sub Admin and Settings
  - Support: only Orders, Customers, Replacement, Reviews ON
- Admin can override toggles after role selection
- Email locked after creation
- Name and password can be changed after creation
- Cancel + "Create admin" button

## 1.21 Settings (6 Tabs)

### Tab 1 — Variables
- **Color (direct units):** color name + hex code (color picker), removable chips with swatch
- **Variant groups** (e.g. Size, Material): group name, units inside as removable chips
- "+ Create variant" dialog: choose type (Color or Group), enter name
- "+ Add unit" / "+ Add group" buttons
- Delete with confirmation (restored)
- No edit (rename) — only delete and re-create
- Duplicate names prevented
- New units can be created on the fly from product add page

### Tab 2 — Delivery & Tax
- Standard delivery fee (₹)
- Free delivery over (₹) — minimum order for free delivery
- GST rate (%)
- GSTIN number
- "Prices include tax" toggle
- Express delivery fee removed
- Delivery radius removed

### Tab 3 — Payment Gateway
- Razorpay: Key ID (masked), Key secret (masked), Connected/Disconnected status (admin manually sets)
- Wallet payments toggle (OFF = shown but greyed/disabled at checkout)
- COD removed

### Tab 4 — Privacy Policy
- React Quill rich text editor
- "Last updated" date (auto-updated on save)

### Tab 5 — Terms & Conditions
- React Quill rich text editor
- "Last updated" date

### Tab 6 — Help & Support
- Phone number
- WhatsApp number
- Email address

### Settings Rules
- All tabs save independently
- Confirmation dialog + toast on save
- Accessible only to admins with Settings permission

## 1.22 Admin Global UX Rules

- Confirmation dialog before **every action** (add, edit, delete, toggle, approve, reject, send, export, stock adjust)
- Toast notifications on success/error
- Skeleton loaders for all loading states
- Empty states show message only
- Breadcrumb navigation on all pages
- Admin profile badge (top right): name + role ("Super admin")
- Logout on top bar with confirmation dialog
- No global search bar (removed)
- No notification bell (removed)
- No Quick actions button (removed)
- No drag-to-reorder anywhere (all ≡ handles removed)
- No category/sub-category visibility toggles (removed)
- No new arrivals status (removed)
- No COD (removed)
- No product import (removed)
- Currency: ₹ INR
- Hard deletes from Firebase throughout
- Image validation: max 2MB, JPG/PNG/WebP, error toast on violation
- CSV format for all data exports
- Responsive: web, desktop, mobile

---

# PART 2: USER APP (Flutter)

## 2.1 App Launch Flow

```
App Opens → Check force update (read general doc)
  → [Update required?] → Force update dialog → Store
  → [No update] → Splash Screen (2-3 sec)
    → [First time?] → Onboarding (3 pages)
    → [Not first time] → [Logged in?] → Home / Login
```

## 2.2 Onboarding (3 Pages)
- Page 1: "Four worlds, one store" — Next
- Page 2: "Spin, earn, save" — Next
- Page 3: "Checkout in seconds" — Get Started
- Skip link on all pages → Login Screen
- Swipeable with dot indicators

## 2.3 Authentication
- Phone number + country code support (MSG91 via `sendotp_flutter_sdk`)
- 6-digit OTP verification with auto-focus + resend timer
- New user → Profile creation (optional, skippable): Display name, WhatsApp number (can differ from login), Friend's code (optional, referral), Email (optional), Profile photo (camera + gallery)
- Skip button on login → Home (guest mode)
- Same Firebase accounts — login works on app and website

## 2.4 Guest Mode
- Can: browse home, categories, products, search, view flash sale/new arrivals
- Cannot (redirects to login): add to cart, wishlist, buy, wallet, profile, spin & win

## 2.5 Bottom Navigation (5 Tabs)
- Home, Category, Bag, Wallet, Profile
- Active tab icon changes color

## 2.6 Home Screen
- Delivery location header
- Search bar
- Banner carousel (auto-scroll, from admin banners with placement = "App")
  - Tap banner → product listing of all attached products
- Flash sale section (countdown timer) + "See all"
- Shop by category + "See all"
- New Arrivals + "See all" (opens separate page)
- No referral banner on home

## 2.7 Search
- Recent search terms as clearable pills
- Searches across: products, categories, sub-categories
- Result count + query text
- Filters button → same filter bottom sheet as category listing
- Product grid (2 columns)
- No results → message with suggested products/categories

## 2.8 Categories
- 2-column grid with admin-uploaded images + category name + product count
- Search icon (top right)
- Tap category → Product Listing

## 2.9 Product Listing
- Category title + wishlist icon
- Sub-category filter tabs (horizontal scroll, "All" default)
- Item count + Sort + Filter
- Sort: Price low-high, Price high-low, Newest, Rating
- Filter bottom sheet: Price range slider, Type pills (multi-select), Rating pills (4.5 & up, 4.0 & up), "Show X results" button
- Product grid (2 columns): category label, wishlist heart, image, name, variant, offer price (or flash price), MRP strikethrough, discount %, rating, "+" add to cart, flash sale badge
- Pagination

## 2.10 Product Detail
- Image carousel (swipeable, dot indicators) + YouTube video (after images)
- Back arrow + Share icon (deep link) + Wishlist heart
- Category label + Rating + review count
- Product name
- Pricing: Offer price + MRP strikethrough + Discount %
  - Flash sale active → Flash price + MRP + Discount %
- Stock status + shipping estimate (from courier API)
- Affiliate banner (affiliate users only): "Referral Price: ₹X · You Earn: ₹X per Sale"
- Color swatches (tap to select, out of stock = greyed)
- Size pills (tap to select, out of stock = greyed)
- Price/stock updates based on selected variant
- Description (rich text)
- Specifications (key-value list)
- Ratings & reviews: overall rating, star breakdown, individual reviews, "See all" link
- Write review button (after delivered, from order screen)
- Frequently bought together (if combo): thumbnails + bundle total + "Add all"
- "You may also like" (same category, horizontal scroll)
- Bottom sticky: Wishlist heart + "Add to bag · ₹X"
  - First tap: adds 1 to cart, text → "Go to Cart"
  - Second tap: navigates to Bag
- All variants out of stock → disabled "Add to bag"
- Always adds 1 quantity (adjusted in cart)

## 2.11 Cart (Bag)
- Title + item count
- Items: thumbnail, name, variant, quantity ± (max 10), price, × remove
- Out of stock items greyed with message (not auto-removed)
- Spin reward banner (if available) + "Apply"
- "Apply a coupon" → Apply Coupon Screen
- Order summary: Subtotal, Spin reward, Delivery (Free/₹X), Total
- "Checkout · ₹total" sticky button

## 2.12 Apply Coupon
- Manual code entry + Apply button
- "From your spins" section
- "Available for you" section
- "Locked" coupons (greyed, with unlock hint)
- Affiliate-only coupons → "Locked" for non-affiliates
- One coupon + one spin reward stackable

## 2.13 Checkout
- Delivery address (selected + "Change" link)
- Delivery method (Standard only, info text)
- Payment: Razorpay (UPI/Card/Netbanking) radio
- Wallet toggle (balance shown, greyed if wallet OFF in settings)
- Items editable from checkout
- Order summary: Subtotal, Spin reward, Wallet, To pay
- "Pay ₹X" sticky button → Confirmation dialog
- Full wallet payment allowed (no Razorpay needed)
- Combo products → combo delivery charge replaces standard fee

## 2.14 Delivery Address
- Saved addresses as radio cards (label, address, phone, DEFAULT badge)
- "+ Add new address" → map/location picker + form: Label (Home/Office/Other), Flat/building, Area, City, State, Pincode
- Delete + Add only, no edit
- First added = default, no toggle
- Delete default → next oldest becomes default

## 2.15 Payment Flow (Razorpay Architecture)
```
"Pay" → createPaymentOrder Cloud Function
  → Server calculates amount (never trust client)
  → Creates Razorpay Order + pending payment doc
  → Returns Razorpay Order ID + Public Key + Transaction ID
    → Razorpay SDK opens
      → Success → razorpayWebhook processes atomically
      → Fail → Payment Failed screen → Retry / Back to Cart

Wallet only → walletOnlyOrder Cloud Function (atomic)
```

## 2.16 Order Success
- Green checkmark + "Order placed"
- Order ID (#BRK-XXXXX) + ETA
- "Track order" button + "Continue shopping" button
- No cashback

## 2.17 My Orders
- Filter tabs: All, Active, Delivered, Cancelled
- Order cards: Order ID, status badge, thumbnails, items + total
- Actions: "Track" (active), "Reorder" (delivered, greyed out of stock items), "Refunded to wallet" (cancelled)
- Tap order → Order Detail

### Order Detail
- Status banner + ETA + "Track" link
- Item list + payment info + discounts
- "Invoice" (only when Delivered, shareable)
- "Cancel item" (only at Pending, refund to original gateway)
- "Return / Replace product" (only replacementAvailable products, after delivered)

### Order Tracking
- ETA headline + product info + savings
- Vertical timeline: Pending → Accepted → Packed → Shipped → Out for delivery → Delivered
- Courier info: name + Tracking ID (Copy link)
- "Track" button + "Return / Replace product" button

## 2.18 Request Replacement
- Product info (name + variant + qty)
- Reason (radio): Item damaged/defective, Wrong item delivered, No longer needed, Quality not as expected
- "Describe the issue" (required)
- "Upload photos" (required, min 1)
- Info: "Approved requests get a free replacement shipped within 24 hours"
- "Submit request" → Confirmation dialog

## 2.19 Invoice
- Share icon
- Barakath logo + "Tax Invoice" + Order ID
- Business info (name, GSTIN, address, TRN)
- Customer info (name, phone, delivery address)
- Line items + discounts + Tax (CGST, SGST) + Grand Total
- Store footer

## 2.20 Wallet (Bottom Tab)
- Balance card ("NORMAL WALLET BALANCE")
- "Add money" → Razorpay top-up (no min/max)
- Breakdown: Rewards + Refunds (no cashback)
- Transaction history: UPI top-up, Spin reward, Order debit, Refund, Admin credit
- Balance never expires

## 2.21 Profile
- Avatar + name + email + edit icon → Edit Profile (photo, name, WhatsApp, email)
- Affiliate dashboard banner (affiliate users only)
- Menu: My orders, Wishlist, Saved addresses, Spin & Win
- Separated: Notifications, Help & support, Settings
- Log out (confirmation dialog)

### Wishlist
- Item count, product cards: category, name, variant, price, MRP, filled heart, add to bag icon

### Notifications
- "Mark all read"
- Grouped: TODAY / EARLIER
- Unread = blue dot
- Tap → deep link to relevant screen
- Read status via SharedPreferences

### Help Centre
- Call (phone), WhatsApp (chat), Email
- No support hours displayed

### Settings
- Full name + Mobile + WhatsApp + Email (editable)
- Privacy policy, Terms & conditions (view)
- Delete account → confirmation dialog → data anonymized (null fields) → logout

## 2.22 Affiliate Flow
- Overview: total earnings, pending, confirmed, referrals, referral code (Copy + Share)
- Affiliate wallet: withdrawable balance, pending, commission history (7-day clearing, admin manual confirm)
- Withdrawal: amount + quick pills (₹1,000/₹5,000/All), bank select, summary, "Confirm withdrawal" (min ₹10,000)
- Add bank account: holder name, account number (enter + re-enter), IFSC (auto-verify), max 2 accounts
- Admin manually approves + transfers outside system

## 2.23 Spin & Win
- Wheel with animation + spins remaining
- "Spin now" → spinWheel Cloud Function → Reward result
- Reward: auto-generated coupon code, conditions, expiry (3 days)
- "Save to coupons" + "Spin again (X left)"
- "Better luck next time" counts as spin
- My coupons: Active/Used/Expired tabs

## 2.24 Write Review (After Delivered)
- Star rating (1-5) + Review text (required) + Photo upload (optional, max 3)
- Submit → confirmation → auto-published
- One per product per order, no edit after submit

## 2.25 App Global Rules
- Confirmation dialog before every action
- Toast notifications on success/error
- Skeleton loaders for all loading states
- Empty states: message only, no action button
- Fully online (no offline support)
- English only, no dark mode
- Force update mechanism (reads from general doc)
- Blocked account: force logout with message
- Notification permission asked after login
- Image validation: max 2MB, JPG/PNG/WebP
- Max cart quantity: 10 per variant
- FCM for push notifications, SharedPreferences for read status

---

# PART 3: USER WEBSITE (Next.js)

## 3.1 Global Header Navigation
- Barakath logo → Home
- Global search bar (live suggestions)
- Categories (grid/menu icon) → mega menu (all categories + sub-categories)
- Wishlist → Wishlist page
- Wallet → Wallet page
- Account/Profile → Login (if guest) or My Orders (if logged in)
- Shopping Cart (item count badge)

## 3.2 Global Footer
- **Shop:** Perfumes, Books, Clothing, Islamic
- **Account:** Orders, Wallet, Profile
- **Support:** Help Center, Contact Us
- **Company:** Privacy Policy, Terms & Conditions
- FAQ removed, About Us removed, Returns removed

## 3.3 Authentication
- Same flow as app: phone + OTP (MSG91 via Cloud Function)
- Two-column web layout: branding panel (left) + phone/OTP form (right)
- No separate Register/Sign In — single flow
- Same Firebase accounts as app
- Guest mode: same as app

## 3.4 Home Page (`/`)
- Hero banner (website banners from admin, 3:1 aspect ratio, carousel auto-scroll)
- Shop by Category (category cards: image + name + short description → no description, just image + name)
- Spin & Win banner → `/spin-win`
- Flash Sale (countdown timer + product cards + "See all")
- New Arrivals (product cards + "See all")
- Best Sellers removed

## 3.5 Categories Page (`/categories`)
- 4-column grid (desktop)
- Category cards: image, name, sub-categories listed below
- No product count
- Tap → Product Listing

## 3.6 Product Listing (`/category/[categoryName]`)
- Breadcrumb (Home > Perfumes)
- Category title + product count
- Left sidebar filters (persistent on desktop, drawer on mobile):
  - Category filter (sub-categories with counts, checkboxes, multi-select)
  - Price range slider
  - Rating filter
- Quick filters above grid: All, In Stock, On Sale (flash sale only)
- Sort dropdown: Popularity, Newest, Price Low-High, Price High-Low, Highest Rated
- Product grid (4 columns desktop, 2 mobile)
- Pagination (numbered pages)

## 3.7 Product Detail (`/product/[productId]`)
- Breadcrumb (Home > Perfumes > Product Name)
- Two-column: gallery (left) + info (right)
- Vertical thumbnail gallery + hover-to-zoom
- YouTube video after gallery
- Product name + rating + reviews + pricing
- Affiliate banner (affiliate users only)
- Color swatches + Size pills (out of stock = greyed)
- Quantity selector (website allows quantity before adding, different from app)
- "Add to Bag" button + Wishlist heart
- Description + Specifications (two-column table) + Reviews + Frequently bought together + Related products
- Flash sale badge + flash price when active
- No Best Seller badge (removed)

## 3.8 Cart + Checkout (Same Page Flow)
- Cart section: items, quantity ±, spin reward, apply coupon, order summary, "Proceed to checkout"
- Checkout section (below cart): breadcrumb progress (Bag > Checkout > Payment), "Secure checkout" branding
- Delivery address + "Change"
- Apply coupon (inline input + applied coupon shown)
- Payment: Razorpay (UPI/Card/Netbanking) or Wallet toggle
- Order summary + "Place order · ₹X"
- Razorpay architecture: same backend-first flow as app

## 3.9 Order Success (`/order-success`)
- Green checkmark + "Order placed" + Order ID + ETA
- "Track order" + "Continue shopping" buttons
- Invoice download only after Delivered (removed from success page)

## 3.10 Account Sidebar (All Account Pages)
- Profile info: avatar, name, mobile
- Menu: My Orders, Wishlist, Wallet, Affiliate Wallet, Saved Addresses, Notifications, Settings, Logout

## 3.11 My Orders (`/account/orders`)
- Order cards: Order ID, status, date, total, thumbnails, item count
- Actions: Track, Invoice (Delivered only), Reorder, Return/Replace
- Cancel only at Pending stage

### Order Detail (`/account/orders/[orderId]`)
- Status + items + payment info
- Track, Invoice (Download PDF + Print, Delivered only), Cancel (Pending only), Return/Replace

### Track Order (`/account/orders/[orderId]/track`)
- Timeline: Pending → Accepted → Packed → Shipped → Out for delivery → Delivered
- Courier name + Tracking ID (Copy)
- No rider distance (removed)
- "Return / Replace product" button

### Request Replacement (`/account/orders/[orderId]/return`)
- Same as app: product info, reason (4 options), description (required), photo upload (required, min 1)
- "Submit request" → confirmation

### Invoice (`/account/orders/[orderId]/invoice`)
- Same as app invoice + Download PDF + Print option
- Includes delivery address + payment method
- Only available when Delivered

## 3.12 Wishlist (`/wishlist`)
- Breadcrumb + item count
- Left sidebar filters (Category, Price range, Rating)
- Quick filters: All, In Stock, On Sale
- Sort dropdown (same as product listing, no Best Selling)
- Product grid (4 columns)
- No "Add to bag" button on cards (click product → detail → add)
- Pagination

## 3.13 Wallet (`/account/wallet`)
- Balance card + "Add money" (Razorpay)
- Breakdown: Rewards + Refunds (no cashback)
- Spin & Win promo card (keep on wallet page)
- Transaction history

## 3.14 Spin & Win (`/spin-win`)
- Spinner wheel + available rewards + Coupon wallet (Active/Used/Expired) on same page
- Same flow as app, no popup
- No cashback rewards (₹50 cashback removed)

## 3.15 Coupon Wallet (`/account/wallet/coupons`)
- Tabs: Active, Used, Expired
- Coupon cards: code, description, conditions, expiry

## 3.16 Affiliate Wallet (`/account/affiliate-wallet`)
- Earnings overview + Lifetime earnings + This Month (web-specific extras)
- Referral code + link (Copy + Share)
- Commission history (no "Commission Adjustment", no percentage)
- Withdrawal + Add bank account (same as app, with quick pills)

### Complete Withdrawal (`/account/affiliate-wallet/withdraw`)
- Same as app flow

## 3.17 Saved Addresses (`/account/addresses`)
- Address cards with delete, "+ Add New Address"
- Same form as app (label, flat, area, city, state, pincode, map/location)
- Delete + Add only, no edit
- First added = default

## 3.18 Notifications (`/account/notifications`)
- Notification list (chronological)
- "Mark all read"
- Grouped by time
- Tap → deep link
- Reads from Firebase `notifications` collection (type = "user" + "admin")
- Read status via localStorage

## 3.19 Settings (`/account/settings`)
- Personal info: Full name, Mobile, WhatsApp, Email (editable)
- Legal: Privacy Policy, Terms & Conditions links
- Danger Zone: Delete account (confirmation dialog, data anonymized, no reason field)

## 3.20 Search (`/search?q={query}`)
- Recent searches (clearable pills)
- Searches: products, categories, sub-categories
- Result count + query
- Product grid (5 columns desktop)
- No filters on search results
- No results → message + suggestions

## 3.21 Payment Failed (`/payment-failed`)
- Red error icon + "Payment failed"
- "Your payment could not be processed. No amount has been deducted."
- "Retry Payment" (→ checkout) + "Back to Cart"
- Colors/fonts match Figma

## 3.22 Banner Products Page (`/banner/[bannerId]`)
- Product listing showing all products attached to the banner

## 3.23 Logout
- Modal dialog: "Log out?" + description + Log out (red) + Cancel

## 3.24 Website-Specific Features (Not in App)
- Breadcrumb navigation on all pages
- Left sidebar filters on product listing + wishlist
- Quick filters: All, In Stock, On Sale
- Sort: Popularity option
- Hover-to-zoom on product images
- Quantity selector on product detail page
- Cart + Checkout on same page flow
- "Secure checkout" branding
- Persistent account sidebar
- Mega menu for categories
- Invoice: Download PDF + Print
- Wallet: Spin & Win promo card
- Affiliate: Lifetime earnings + This Month stats
- 4-5 column product grids (desktop)
- Responsive: Desktop ≥1024px, Tablet 768-1023px, Mobile <768px

## 3.25 Website Global Rules
- Confirmation dialog before every action
- Toast notifications on success/error
- Skeleton loaders for all loading states
- Empty states: message only
- English only, no dark mode
- Guest browsing: same as app
- Razorpay architecture: same backend-first flow
- No force update needed

---

# PART 4: FIREBASE DATA MODEL

## 4.1 Collections Summary

**Top-level collections: 20**
1. categories
2. subCategories
3. colors
4. variantGroups
5. variantUnits
6. products
7. orders
8. customers
9. payments
10. replacementRequests
11. reviews
12. coupons
13. spinnerCampaigns
14. spinRewards
15. withdrawalRequests
16. flashSales
17. notifications
18. subAdmins
19. stockAdjustments
20. general (single document: "general")

**Sub-collections: 9**
1. products/{id}/variants
2. customers/{id}/walletTransactions
3. customers/{id}/commissionTransactions
4. customers/{id}/bankAccounts
5. customers/{id}/addresses
6. coupons/{id}/usageHistory
7. spinnerCampaigns/{id}/offers
8. spinnerCampaigns/{id}/spinUsage
9. general/general/razorpay

## 4.2 Collection: `categories`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| categoryName | String | Yes | |
| categoryImage | String (URL) | Yes | Max 2MB, JPG/PNG/WebP |
| productsCount | Number | Yes | Default 0, auto-updated |
| keywords | Array | Yes | From categoryName |
| createdAt | Timestamp | Yes | Auto-generated, display order |
| updatedAt | Timestamp | Yes | Auto-updated |

## 4.3 Collection: `subCategories`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| subCategoryName | String | Yes | |
| categoryId | String | Yes | Reference to parent category |
| productsCount | Number | Yes | Default 0, auto-updated |
| keywords | Array | Yes | From subCategoryName |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

## 4.4 Collection: `colors`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| colorName | String | Yes | Unique, no duplicates |
| colorHexCode | String | Yes | From color picker UI |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

## 4.5 Collection: `variantGroups`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| groupName | String | Yes | Unique (e.g. Size, Material) |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

## 4.6 Collection: `variantUnits`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| groupId | String | Yes | Reference to parent group |
| unitName | String | Yes | Unique within group |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

## 4.7 Collection: `products`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| productName | String | Yes | |
| sku | String | Yes | Admin-entered, unique |
| categoryId | String | Yes | Reference to category |
| subCategoryId | String | Yes | Reference to sub-category |
| description | String (HTML) | Yes | Rich text |
| images | Array of Strings (URLs) | Yes | Max 5, first = hero |
| youtubeVideoLink | String (URL) | No | Optional |
| isCombo | Boolean | Yes | Default false |
| comboDeliveryCharge | Number | No | Only when isCombo = true |
| replacementAvailable | Boolean | Yes | Per product toggle |
| lowStockThreshold | Number | Yes | Per product |
| status | String | Yes | Active / Archived |
| specifications | Array of Objects | No | Max 10, each {key, value} |
| frequentlyBoughtTogether | Array of Strings | No | Max 10 productIds, only when isCombo = true |
| isNewArrival | Boolean | Yes | Default false |
| newArrivalAddedAt | Timestamp | No | Set when toggled true |
| isOnFlashSale | Boolean | Yes | Default false, set by flashSaleManager |
| flashSaleId | String | No | Reference to active flash sale |
| averageRating | Number | Yes | Default 0, recalculated by onReviewChange |
| totalReviews | Number | Yes | Default 0, recalculated by onReviewChange |
| keywords | Array | Yes | From productName + categoryName + subCategoryName |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

### Sub-collection: `products/{productId}/variants`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| colorId | String | Yes | Reference to color |
| groupId | String | Yes | Reference to variant group |
| unitId | String | Yes | Reference to unit |
| mrp | Number | Yes | Maximum retail price |
| offerPrice | Number | Yes | Must be < MRP |
| referralPrice | Number | Yes | Must be < Offer price |
| commission | Number | Yes | Fixed ₹, must be < Referral price |
| stock | Number | Yes | Per variant, min 0 |
| flashSalePrice | Number | No | Set by flashSaleManager, null when not on sale |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

## 4.8 Collection: `orders`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| orderId | String | Yes | Auto-incrementing #BRK-XXXXX |
| customerId | String | Yes | Reference to customer |
| items | Array of Objects | Yes | Product snapshots (see below) |
| status | String | Yes | Pending/Accepted/Packed/Shipped/Out for delivery/Delivered/Cancelled |
| paymentMethod | String | Yes | Razorpay / Wallet / Both |
| paymentStatus | String | Yes | Paid / Failed |
| transactionId | String | Yes | pay_XXXXX or wal_XXXXX |
| subtotal | Number | Yes | Before discounts |
| discounts | Number | No | Total discounts applied |
| deliveryFee | Number | Yes | Standard fee or 0 |
| taxableValue | Number | Yes | Subtotal before tax |
| cgst | Number | Yes | Central GST |
| sgst | Number | Yes | State GST |
| totalTax | Number | Yes | cgst + sgst |
| total | Number | Yes | Final amount |
| couponCode | String | No | Applied coupon |
| spinRewardCode | String | No | Applied spin reward |
| walletAmountUsed | Number | No | Wallet deducted |
| razorpayAmount | Number | No | Razorpay portion |
| deliveryAddress | Object | Yes | Address snapshot (see below) |
| courier | String | No | Manual or courier API |
| awbNumber | String | No | Tracking number |
| rider | String | No | Rider name |
| eta | String | No | Estimated delivery |
| pendingAt | Timestamp | No | |
| acceptedAt | Timestamp | No | |
| packedAt | Timestamp | No | |
| shippedAt | Timestamp | No | |
| outForDeliveryAt | Timestamp | No | |
| deliveredAt | Timestamp | No | |
| cancelledAt | Timestamp | No | |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

### Order items array object:

| Field | Type | Notes |
|-------|------|-------|
| productId | String | Reference |
| productName | String | Snapshot |
| variantId | String | Reference |
| variantDetails | String | e.g. Blue · 100ml |
| quantity | Number | |
| price | Number | Offer/flash price at time of order |
| image | String | Product image URL snapshot |

### Delivery address object:

| Field | Type | Notes |
|-------|------|-------|
| customerName | String | Snapshot |
| phone | String | Snapshot |
| label | String | Home/Office/Other |
| flatBuilding | String | |
| area | String | |
| city | String | |
| state | String | |
| pincode | String | |

## 4.9 Collection: `customers`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| displayName | String | No | Optional |
| phone | String | Yes | With country code |
| whatsappNumber | String | No | Can differ from login |
| email | String | No | Optional |
| profilePhoto | String (URL) | No | Camera/gallery |
| friendCode | String | No | Referral code at signup |
| referredByCustomerId | String | No | Direct reference to affiliate |
| isAffiliate | Boolean | Yes | Default false |
| referralCode | String | No | Auto-generated when affiliate |
| affiliateBalance | Number | No | Withdrawable balance |
| pendingCommission | Number | No | Admin manually confirms |
| confirmedCommission | Number | No | Lifetime confirmed |
| totalReferrals | Number | No | Count |
| affiliateEnabled | Boolean | No | Wallet access toggle |
| walletBalance | Number | Yes | Default 0 |
| ordersCount | Number | Yes | Default 0, auto-updated |
| status | String | Yes | Active / Blocked |
| fcmToken | String | No | For push notifications |
| cart | Array of Objects | No | Cart items (see below) |
| wishlist | Array of Strings | No | ProductIds |
| keywords | Array | Yes | From displayName + phone + email |
| createdAt | Timestamp | Yes | Auto-generated |
| updatedAt | Timestamp | Yes | Auto-updated |

### Cart array object:

| Field | Type | Notes |
|-------|------|-------|
| productId | String | Reference |
| variantId | String | Reference |
| quantity | Number | Min 1, max 10 |
| addedAt | Timestamp | When added |

### Sub-collection: `customers/{customerId}/walletTransactions`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| type | String | Yes | Credit / Debit |
| source | String | Yes | Refund, Spin reward, Order, Admin credit, UPI top-up |
| amount | Number | Yes | |
| createdAt | Timestamp | Yes | |

### Sub-collection: `customers/{customerId}/commissionTransactions`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| type | String | Yes | Commission / Withdrawal |
| orderId | String | No | For commission |
| referredCustomerId | String | No | Who placed order |
| referredCustomerName | String | No | Snapshot |
| amount | Number | Yes | |
| status | String | Yes | Pending / Confirmed |
| clearsAt | Timestamp | No | For pending |
| keywords | Array | Yes | Customer name |
| createdAt | Timestamp | Yes | |

### Sub-collection: `customers/{customerId}/bankAccounts`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| accountHolderName | String | Yes | |
| accountNumber | String | Yes | |
| ifscCode | String | Yes | |
| bankName | String | Yes | Auto-verified from IFSC |
| bankBranch | String | No | Auto-verified |
| createdAt | Timestamp | Yes | |

### Sub-collection: `customers/{customerId}/addresses`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| label | String | Yes | Home/Office/Other |
| flatBuilding | String | Yes | |
| area | String | Yes | |
| city | String | Yes | |
| state | String | Yes | |
| pincode | String | Yes | |
| latitude | Number | Yes | From map/location picker |
| longitude | Number | Yes | From map/location picker |
| isDefault | Boolean | Yes | First added = default |
| createdAt | Timestamp | Yes | |

## 4.10 Collection: `payments`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| transactionId | String | Yes | pay_XXXXX or wal_XXXXX |
| orderId | String | Yes | Reference to order |
| customerId | String | Yes | Reference to customer |
| method | String | Yes | UPI/Card/Netbanking/Wallet |
| gateway | String | Yes | "Razorpay" or "—" |
| razorpayAmount | Number | No | Razorpay portion |
| walletAmountUsed | Number | No | Wallet portion |
| amount | Number | Yes | Total amount |
| status | String | Yes | Success/Failed/Pending |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

## 4.11 Collection: `replacementRequests`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| requestId | String | Yes | Auto-incrementing #RP-XXXX |
| orderId | String | Yes | Reference to order |
| customerId | String | Yes | Reference to customer |
| productId | String | Yes | Reference to product |
| productName | String | Yes | Snapshot |
| variantId | String | Yes | Reference to variant |
| variantDetails | String | Yes | e.g. Blue · 100ml |
| quantity | Number | Yes | |
| reason | String | Yes | 4 options |
| description | String | Yes | User describes issue |
| photos | Array of Strings (URLs) | Yes | Min 1 |
| status | String | Yes | Pending/Approved/Rejected |
| rejectionReason | String | No | Required on reject |
| replacementOrderId | String | No | Auto-created on approval |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

## 4.12 Collection: `reviews`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| customerId | String | Yes | Reference |
| customerName | String | Yes | Snapshot |
| productId | String | Yes | Reference |
| orderId | String | Yes | Reference to delivered order |
| rating | Number | Yes | 1-5 |
| reviewText | String | Yes | |
| photos | Array of Strings (URLs) | No | Max 3 |
| status | String | Yes | Published/Hidden |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

## 4.13 Collection: `coupons`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| couponCode | String | Yes | Unique, uppercase, no spaces |
| discountType | String | Yes | Fixed/Percentage/FreeShipping |
| discountValue | Number | No | Not required for FreeShipping |
| maxDiscount | Number | No | Cap for percentage |
| minCartValue | Number | No | |
| usageLimit | Number | Yes | Total uses |
| usedCount | Number | Yes | Default 0 |
| expiryDate | Timestamp | No | Null = no expiry |
| targetUsers | String | Yes | All users/New users/Affiliates |
| categoryRestriction | Array of Strings | No | Array of categoryIds |
| keywords | Array | Yes | From couponCode |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

### Sub-collection: `coupons/{couponId}/usageHistory`

| Field | Type | Required |
|-------|------|----------|
| customerId | String | Yes |
| orderId | String | Yes |
| usedAt | Timestamp | Yes |

## 4.14 Collection: `spinnerCampaigns`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| campaignName | String | Yes | |
| startDate | Timestamp | Yes | |
| endDate | Timestamp | Yes | |
| spinsPerUserPerDay | Number | Yes | |
| eligibility | String | Yes | All users/New users/Affiliates |
| isActive | Boolean | Yes | Active/Paused |
| totalPlays | Number | Yes | Default 0 |
| conversionRate | Number | Yes | Auto-calculated % |
| keywords | Array | Yes | From campaignName |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

### Sub-collection: `spinnerCampaigns/{campaignId}/offers`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| offerType | String | Yes | Flat/Percentage/Fixed |
| rewardText | String | Yes | |
| discountValue | Number | No | 0 = Better luck |
| minOrderValue | Number | No | |
| maxDiscount | Number | No | For percentage |
| probability | Number | Yes | Must total 100% |
| usedCount | Number | Yes | Default 0 |
| createdAt | Timestamp | Yes | |

### Sub-collection: `spinnerCampaigns/{campaignId}/spinUsage`

| Field | Type | Required |
|-------|------|----------|
| customerId | String | Yes |
| date | String | Yes (YYYY-MM-DD) |
| spinsUsed | Number | Yes |

## 4.15 Collection: `spinRewards`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| campaignId | String | Yes | |
| customerId | String | Yes | |
| offerId | String | Yes | |
| couponCode | String | Yes | Auto-generated (SPIN[value]-[4 random]) |
| rewardText | String | Yes | Snapshot |
| minOrderValue | Number | No | Snapshot |
| expiresAt | Timestamp | Yes | 3 days from win |
| status | String | Yes | Active/Used/Expired |
| usedOnOrderId | String | No | |
| createdAt | Timestamp | Yes | |

## 4.16 Collection: `withdrawalRequests`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| customerId | String | Yes | Reference to affiliate |
| amount | Number | Yes | |
| bankName | String | Yes | |
| accountNumber | String | Yes | Masked in display |
| ifscCode | String | Yes | |
| accountHolderName | String | Yes | |
| processingFee | Number | Yes | Currently ₹0 |
| netAmount | Number | Yes | amount - fee |
| status | String | Yes | Pending/Approved/Rejected |
| adminNote | String | No | If rejected |
| keywords | Array | Yes | Customer name |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

## 4.17 Collection: `flashSales`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| saleName | String | Yes | |
| discountType | String | Yes | Percentage/Flat |
| discountValue | Number | Yes | |
| productIds | Array of Strings | Yes | Min 2 |
| startDateTime | Timestamp | Yes | |
| endDateTime | Timestamp | Yes | |
| isActive | Boolean | Yes | Toggle on/off |
| keywords | Array | Yes | From saleName |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

## 4.18 Collection: `notifications`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| type | String | Yes | "admin" or "user" |
| customerId | String | No | Required when type = "user" |
| title | String | Yes | |
| message | String | Yes | |
| audience | String | No | For admin: All users/Order updates/Active 30d |
| deepLink | String | Yes | Home/Product/Category/Flash sale/Spinner/Order/Wallet/Coupons |
| referenceId | String | No | orderId/couponId etc. |
| sendType | String | No | For admin: Now/Scheduled |
| scheduledAt | Timestamp | No | For admin scheduled |
| sentCount | Number | No | For admin type |
| openedCount | Number | No | For admin type |
| status | String | Yes | Sent/Automated/Scheduled |
| keywords | Array | No | From title, admin type only |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

Admin broadcasts: single document, client queries both admin + user types.
Read status: SharedPreferences (app) / localStorage (website) — no Firestore sub-collection.

## 4.19 Collection: `subAdmins`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| fullName | String | Yes | Editable |
| email | String | Yes | Locked after creation |
| password | String | Yes | Hashed, strong rules |
| phone | String | Yes | With country code |
| role | String | Yes | Super admin/Manager/Support |
| permissions | Object | Yes | Boolean per module |
| status | String | Yes | Active/Suspended |
| lastActive | Timestamp | No | Auto-updated |
| keywords | Array | Yes | From fullName + email + phone |
| createdAt | Timestamp | Yes | |
| updatedAt | Timestamp | Yes | |

## 4.20 Collection: `stockAdjustments`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | Firebase auto-generated |
| productId | String | Yes | Reference |
| variantId | String | Yes | Reference |
| sku | String | Yes | Snapshot |
| previousStock | Number | Yes | |
| adjustment | Number | Yes | +/- amount |
| newStock | Number | Yes | |
| reason | String | Yes | |
| referenceNote | String | No | |
| adjustedBy | String | Yes | Admin ID |
| createdAt | Timestamp | Yes | |

## 4.21 Collection: `general` → Document: `general`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| standardDeliveryFee | Number | Yes | |
| freeDeliveryOver | Number | Yes | |
| gstRate | Number | Yes | |
| gstin | String | Yes | |
| pricesIncludeTax | Boolean | Yes | |
| walletPayments | Boolean | Yes | |
| courierMode | String | Yes | "manual" or "api" |
| courierProvider | String | No | "shadowfax" when api |
| courierApiKey | String | No | When api mode |
| courierApiSecret | String | No | When api mode |
| businessName | String | Yes | For invoices |
| businessAddress | String | Yes | For invoices |
| businessTRN | String | Yes | Tax Registration Number |
| privacyPolicyContent | String (HTML) | Yes | React Quill |
| privacyPolicyUpdatedAt | Timestamp | Yes | |
| termsContent | String (HTML) | Yes | React Quill |
| termsUpdatedAt | Timestamp | Yes | |
| helpPhone | String | Yes | |
| helpWhatsapp | String | Yes | |
| helpEmail | String | Yes | |
| banners | Array of Objects | Yes | All banners |

### Banner object:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | String | Yes | |
| bannerTitle | String | Yes | |
| bannerImage | String (URL) | Yes | |
| placement | String | Yes | App/Website |
| aspectRatio | String | Yes | "16:9" or "3:1" |
| attachedProductIds | Array of Strings | Yes | Min 1 |
| isLive | Boolean | Yes | |
| createdAt | Timestamp | Yes | Display order |

### Sub-collection: `general/general/razorpay`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| keyId | String | Yes | Masked display |
| keySecret | String | Yes | Masked display |
| status | String | Yes | Connected/Disconnected |

## 4.22 Firebase Storage Paths

| Image Type | Storage Path |
|-----------|-------------|
| Category images | `categories/{categoryId}/image` |
| Product images | `products/{productId}/{imageIndex}` |
| Banner images | `banners/{bannerId}/image` |
| Profile photos | `customers/{customerId}/profile` |
| Review photos | `reviews/{reviewId}/{photoIndex}` |
| Replacement photos | `replacements/{requestId}/{photoIndex}` |

## 4.23 Keywords Strategy

| Collection | Keywords Source |
|-----------|---------------|
| categories | categoryName |
| subCategories | subCategoryName |
| products | productName + categoryName + subCategoryName |
| customers | displayName + phone + email |
| subAdmins | fullName + email + phone |
| coupons | couponCode |
| spinnerCampaigns | campaignName |
| flashSales | saleName |
| notifications | title (admin type only) |
| withdrawalRequests | customer name |
| commissionTransactions | customer name |

---

# PART 5: CLOUD FUNCTIONS (23)

## 5.1 Razorpay Payment Architecture (Critical)

- No payment verification on client (Flutter, React, Next.js)
- No amount calculation on client — always server-side
- Razorpay keys read from Firestore or Secret Manager, never hardcoded
- Firebase Authentication verified inside every Cloud Function
- Firestore Transactions for all atomic operations
- Idempotent webhook processing
- Proper error handling + logging
- Retry-safe implementation

## 5.2 HTTP Functions (12)

| # | Function | Description |
|---|----------|-------------|
| 1 | authOTP | Send + verify OTP via MSG91 (website only) |
| 2 | createSubAdmin | Create sub admin with Firebase Auth |
| 3 | createPaymentOrder | Verify auth → calculate amount server-side → create Razorpay order → create pending payment |
| 4 | walletOnlyOrder | Full wallet payment → atomic order creation |
| 5 | cancelOrder | Verify admin auth → atomic: restore stock + Razorpay refund + update order |
| 6 | processRefund | Verify admin auth → Razorpay Refund API → atomic updates |
| 7 | spinWheel | Validate spins + calculate reward + generate coupon |
| 8 | approveReplacement | Verify admin → create free replacement order + trigger refund if needed |
| 9 | generateInvoicePDF | Generate tax invoice PDF |
| 10 | addWalletMoney | Verify Razorpay payment → credit wallet + log + FCM |
| 11 | generateReferralCode | Generate unique code on affiliate allocation |
| 12 | trackReferralSignup | Link new user to affiliate + increment referrals + FCM |

## 5.3 Webhook Functions (2)

| # | Function | Description |
|---|----------|-------------|
| 13 | razorpayWebhook | Validate signature → atomic: create order + deduct stock + apply coupon/wallet + commission + notifications |
| 14 | courierWebhook | (Future) Shadowfax status updates → auto-update order |

## 5.4 Firestore Triggers (5)

| # | Function | Trigger | Description |
|---|----------|---------|-------------|
| 15 | onOrderUpdate | orders/{id} onUpdate | Status change: FCM + notification + on Delivered: confirm commission |
| 16 | onReviewChange | reviews/{id} onChange | Recalculate product averageRating + totalReviews |
| 17 | onProductDelete | products/{id} onDelete | Cleanup flash sales, banners, decrement category/sub-category counts |
| 18 | onReplacementUpdate | replacementRequests/{id} onUpdate | Approved/rejected: FCM + notification |
| 19 | onWalletAdminCredit | walletTransactions onCreate | Admin adds money: FCM + notification |

## 5.5 Cloud Scheduler (2)

| # | Function | Schedule | Description |
|---|----------|----------|-------------|
| 20 | dailyCleanup | Daily midnight | Expire spin rewards + coupons + spinner campaigns |
| 21 | flashSaleManager | Every minute | Activate/deactivate flash sales + update variant flashSalePrice |

## 5.6 Future — Courier API (2)

| # | Function | Description |
|---|----------|-------------|
| 22 | assignToCourier | HTTP: Send order to Shadowfax API |
| 23 | fetchTrackingInfo | HTTP: Get real-time tracking |

---

# PART 6: PACKAGES

## 6.1 Admin Panel (React + Vite)

- React, Vite, React Router DOM
- Tailwind CSS or CSS Modules
- React Icons
- React Hot Toast
- Firebase SDK (Auth, Firestore, Storage, Cloud Functions)
- React Quill (Privacy Policy, T&C)
- TanStack Table (data tables)
- Papaparse (CSV export)
- React Hook Form + Zod (forms/validation)
- Recharts or Chart.js (analytics charts)
- React Dropzone (image upload)
- Browser Image Compression
- date-fns or Day.js
- React Datepicker
- React Colorful or React Color (color picker)
- jsPDF or React-PDF (invoice)
- Zustand or React Context (state)
- React Loading Skeleton
- UUID

## 6.2 User App (Flutter)

- Flutter SDK, Dart
- firebase_core, firebase_auth, cloud_firestore, firebase_storage, firebase_messaging
- sendotp_flutter_sdk (MSG91)
- Provider / Riverpod / Bloc (state)
- go_router or auto_route (routing)
- razorpay_flutter (payments)
- google_fonts, flutter_svg, cached_network_image
- shimmer (skeleton loaders)
- image_picker, image_cropper, image_compression_flutter
- carousel_slider, smooth_page_indicator
- intl (date/currency formatting)
- shared_preferences
- uni_links or app_links (deep linking)
- share_plus (share referral)
- url_launcher (WhatsApp, phone, email)
- youtube_player_flutter or youtube_player_iframe
- geolocator, geocoding, google_maps_flutter (location/maps)
- flutter_local_notifications
- webview_flutter (Privacy Policy, T&C)
- connectivity_plus
- upgrader (force update)
- pin_code_fields (OTP input)
- flutter_rating_bar (reviews)
- country_code_picker

## 6.3 Website (Next.js)

- Next.js (App Router), React, TypeScript
- Firebase SDK + Firebase Admin SDK (SSR)
- Tailwind CSS
- Headless UI or Radix UI
- React Icons or Lucide React
- React Hot Toast
- MSG91 HTTP API (via Cloud Function)
- Razorpay JS SDK
- Zustand or React Context
- React Hook Form + Zod
- next/image
- React Dropzone
- Swiper or Embla Carousel
- date-fns or Day.js
- React Loading Skeleton
- react-youtube or lite-youtube-embed
- Web Share API, navigator.clipboard
- next/head or Metadata API, next-sitemap (SEO)
- Google Maps JavaScript API
- sharp (image optimization)

## 6.4 Backend (Cloud Functions)

- firebase-admin, firebase-functions
- Razorpay Node SDK
- MSG91 HTTP API
- PDFKit or jsPDF (server-side invoice)
- Cloud Scheduler

---

# PART 7: TAX INVOICE TEMPLATE

## Layout

### Header
- Left: Barakath logo + Business name
- Right: "Tax Invoice" + Invoice # + Date

### Business Info
- Name, GSTIN, Address, TRN (from general doc)

### Customer Info
- Name, Phone, Delivery address

### Order Info
- Order ID, Date, Payment method, Transaction ID

### Items Table
| # | Product | Variant | Qty | Unit Price (₹) | Total (₹) |
|---|---------|---------|-----|----------------|-----------|

### Price Summary
- Subtotal, Coupon discount, Wallet used, Delivery, Taxable value, CGST, SGST, Grand Total

### Footer
- "Computer-generated invoice" + Business name + location

Generated by: Cloud Function `generateInvoicePDF`

---

# PART 8: DEFERRED ITEMS (Future Sessions)

- Privacy Policy, Terms & Conditions, Help Center, 404 page layouts (website)
- Courier API details (Shadowfax integration)
- Error states / no internet UI
- Referral landing page details
- Write review detailed UI for website
- Color picker implementation details
- Stock history detailed logging views
- Delete account flow on website
