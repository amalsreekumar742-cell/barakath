# Website Batch 2 — Shared Layer Notes

Written by **B0**. **B1–B5 read this first**, then `WEB_BATCH1_NOTES.md`. It records the exact
field names, the shared modules B0 built, their signatures, and the places the **Batch 2 prompt
document disagrees with the live code**. Where they disagree, the live code wins and this file says so.

Everything B0 built compiles clean: `tsc --noEmit` ✅, `eslint .` ✅, `next build` ✅ (25/25 pages).

---

## 0. What B0 built (import these; do not re-implement)

| File | Exports |
|---|---|
| `src/lib/pricing.ts` | `resolvePrice(product, variant)`, `ResolvedPrice` — **the single pricing truth** |
| `src/lib/data/flashSales.ts` | `getActiveFlashSale()`, `ActiveFlashSale`, re-exported `getFlashSaleProducts` |
| `src/lib/data/products.ts` | `buildProductQuery(params)`, `toPageResult(snap, ctx)`, `getFilterFacets({categoryId})`, types `ProductSort`, `BuildProductQueryParams`, `PageResult`, `FilterFacets` |
| `src/lib/seo.ts` | `buildMetadata`, `productSchema`, `breadcrumbSchema`, `itemListSchema`, `organizationSchema` |
| `src/components/catalog/FlashCountdown.tsx` | `FlashCountdown` (Client Component) |
| `src/components/Pagination.tsx` | `Pagination` — now takes an optional `hrefBuilder` |
| `firebase/firestore.indexes.json` | +8 composite indexes appended (see §7) |
| `packages/shared/.../flashSale.ts` | `FlashSaleProps.activated?: boolean` added (real server field) |

**Exact signatures** (B1–B5 are briefed against these):

```ts
resolvePrice(product: ProductProps, variant: VariantProps): {
  displayPrice: number; mrp: number; discountPercent: number; isFlash: boolean;
}

getActiveFlashSale(): Promise<{ id: string; name: string; endDate: Timestamp } | null>

buildProductQuery(params: {
  categoryId?: string; subCategoryNames?: string[]; productIds?: string[];
  minPrice?: number; maxPrice?: number; minRating?: number;
  stockFilter?: 'inStock' | 'all'; saleFilter?: 'onSale' | 'all'; isNewArrival?: boolean;
  sort?: 'popularity' | 'newest' | 'priceAsc' | 'priceDesc' | 'rating';
  after?: string; before?: string; limit?: number;
}): Promise<PageResult>

toPageResult(snap: QuerySnapshot<DocumentData>,
  ctx: { limit: number; direction?: 'forward' | 'backward'; hasCursor?: boolean }): PageResult
// PageResult = { items: ProductProps[]; firstDocId: string|null; lastDocId: string|null; hasNext: boolean; hasPrev: boolean }

getFilterFacets({ categoryId }: { categoryId?: string }): Promise<{
  subCategories: { name: string; count: number }[];
  priceBounds: { min: number; max: number } | null;
}>

buildMetadata({ title, description, path, image? }): Metadata
productSchema(product: ProductProps, variant: VariantProps, reviews?: ReviewProps[]): Record<string, unknown>
breadcrumbSchema(trail: { name: string; path?: string }[]): Record<string, unknown>
itemListSchema(products: ProductProps[]): Record<string, unknown>
organizationSchema(settings: GeneralSettingsProps | null): Record<string, unknown>

<FlashCountdown endDate={Timestamp | number} onExpire?={() => void} className?={string} />
```

---

## A. NO Admin SDK — server reads use `serverDb`

All server reads go through the Web SDK handle `serverDb` from `@/lib/data/serverFirestore` (works
because `categories/products/variants/banners/flashSales/reviews/general` are world-readable per
`firestore.rules`). **Do NOT create `src/lib/firebase/admin.ts`.** A Server Component can only read what
a signed-out visitor could — that is a feature (user-specific data is structurally impossible to fetch
on the server).

**ISR:** `export const revalidate = <literal>` **per route segment** (Next rejects an imported
identifier). Catalog pages use `300`. **A segment that renders a live flash-sale price/countdown should
use `revalidate = 60`** — the scheduler flips flags every 5 minutes, so 60s bounds how long a stale
flash price can show. Write the literal in the segment and add a one-line comment; do NOT export a
shared constant.

## B. FLASH SALE — the real schema and read model

Verified against `functions/src/utility/flashSaleManager.ts` + `packages/shared`:

- Product flag: **`ProductProps.isFlashSale`** (boolean). NOT `isOnFlashSale`.
- Variant flash price: **`VariantProps.flashSalePrice?: number`** — present ONLY while a sale is live,
  **deleted** when it ends. Never read it without checking `isFlashSale`; **never treat absence as ₹0.**
- Flash doc `FlashSaleProps`: **`name`** (not saleName), **`startDate`/`endDate`** Timestamps (not
  startDateTime/endDateTime), **`isActive`**, server-managed **`activated`** (B0 added this optional
  field to the shared type — it is what the scheduler writes and what proves the prices are applied),
  `products[].variantPrices[].flashSalePrice`, `productIds[]`.
- The scheduler runs **every 5 minutes**. The site READS flags; it never computes windows.

**Read model — do this, don't invent your own:**
1. `getActiveFlashSale()` → the single live sale (`isActive && activated && startDate<=now<endDate`) or
   null. Returns `{ id, name, endDate }`.
2. `getFlashSaleProducts(limit)` (from `flashSales.ts` or `catalog.ts`) → the flagged products.
3. For each product, pair it with its first variant via `getFirstVariantByProduct(ids)` (from
   `catalog.ts`), then call **`resolvePrice(product, variant)`** to get the flash price. The product flag
   alone carries no price.
4. Pass `sale.endDate` to `<FlashCountdown/>` — **as `endDate.toMillis()` (a number)**, see §D.

## C. NO `ordersCount` field — popularity is a proxy

There is **no sales/orders counter** anywhere in the schema. `sort: 'popularity'` maps to
**`totalReviews` desc** — the honest, already-denormalised proxy (same one W0's `getBestSellers` uses).
Document it as a proxy in any UI copy; never sort by a non-existent field (Firestore returns nothing,
silently).

## D. Catalog components — what exists vs what you build

**Already built (W4), at `@/components/catalog/`** — reuse, do not fork:
`ProductCard`, `ProductGrid`, `PriceBlock`, `RatingStars`, `WishlistHeart`, `SectionHeader`,
`CategoryPill`, `CategoryCard`, `ProductCardSkeleton`, `ProductGridSkeleton`,
**`FlashCountdown` (B0)**.

**Do NOT exist — a later session builds each (do not assume they are here):**
`FilterSidebar`, `SortDropdown`, `QuickFilters`, `ReviewList`, `PriceDisplay`.

**`PriceBlock` is read-only** — it renders a min–max RANGE from `ProductProps` (which has no MRP). A
surface that has resolved to ONE variant (PDP, cart, a single-price card) calls **`resolvePrice`
directly** for the exact figure/MRP/discount and lays it out itself. Do NOT modify `PriceBlock`.

`FlashCountdown` props: `{ endDate: Timestamp | number; onExpire?: () => void; className? }`. It ticks
HH:MM:SS, **recomputing from `Date.now()` every tick** (tab-suspend safe), and at zero calls
`onExpire ?? router.refresh()`. **Pass `endDate` as millis** (`sale.endDate.toMillis()`) — a raw
`Timestamp` loses `.toMillis()` when serialized across the RSC boundary (the component handles the
serialized `{seconds,nanoseconds}` shape defensively, but millis is the clean path). Renders nothing if
already past or before mount (no hydration mismatch).

## E. Data layer — reuse `catalog.ts`, never duplicate a query

`@/lib/data/catalog.ts` already exports `getProducts`, `getFlashSaleProducts`, `getBanners`,
`getProductReviews`, `getCategories`, `getSubCategories`, `getVariants`, `getFirstVariantByProduct`,
`getProductsByIds`, `getNewArrivals`, `getBestSellers`, `getCategoryByName`, `getProductById`,
`searchProducts`, `getAllProductIdsForSitemap`. **Read it before writing a query.** `buildProductQuery`
(B0) reuses `getProductsByIds` and `getSubCategories` internally.

## F. BANNERS — single-link promo, NO product set

`BannerProps` (shared, live): a banner is a **single-link** promo:
`linkType` (`Product` | `Category` | `External` | `None`) + `linkValue` + denormalised
`linkProductName` / `linkCategoryName`, plus `title`, `image`, `placement` (`App`|`Website`|`Both`),
`position`, `isActive`, `startDate`/`endDate` (`Timestamp | null`).

**There is NO list of "attached products" on a banner.** The "banner products page" (spec §3.22) is
therefore driven by the banner's LINK: `linkType==='Category'` → render that category's products via
`buildProductQuery({ categoryId })`; `linkType==='Product'` → it points at one product (redirect/deep
link); `External` → outbound URL; `None` → no destination. Do not look for a `productIds` array on a
banner — it does not exist. Use `getBanners(placement)` from `catalog.ts` (filters `isActive` + the date
window in memory).

---

## Pagination approach (server pages)

`buildProductQuery` paginates by **document id in the URL**, not by an in-memory cursor stack:
- `?after=<docId>` → `getDoc(after)` then `startAfter + limit(N)` (page forward).
- `?before=<docId>` → `getDoc(before)` then `endBefore + limitToLast(N)` (page backward).
- `toPageResult` returns `{ items, firstDocId, lastDocId, hasNext, hasPrev }`. `hasNext = size === limit`
  (a full page implies more — the same heuristic as the rest of `catalog.ts`); backward pages force
  `hasNext=true`. `firstDocId`/`lastDocId` are the cursors for Prev/Next respectively.

**In-memory narrowing (important):** Firestore allows a range/inequality on only ONE field and it must
be the first orderBy — which the sort already owns. So `buildProductQuery` pushes only the range that
matches the sort field server-side (**price bounds when sorting by price; `minRating` when sorting by
rating**) and **narrows the rest in memory over the fetched page** (`stockFilter` always; price when the
sort isn't price; rating when the sort isn't rating). Consequence: **a page may display fewer than
`limit` items**, but the cursor (`firstDocId`/`lastDocId`) still tracks the true Firestore boundary, so
Next/Prev never skip or repeat. Show a "load more / next" affordance accordingly; do not assume exactly
12 rows per page when range filters are active.

**`Pagination` link mode:** B0 added an optional `hrefBuilder?: (page:number)=>string`. When present,
Prev/Next/number controls render as crawlable `<Link>`s. **Caveat:** a function prop cannot cross the
RSC boundary, so a Server-Component listing supplies `hrefBuilder` from a thin `'use client'` wrapper (a
few lines) that reads the `?after=`/`?before=` searchParams and builds the href. Client pages keep using
`onGoToPage` (both props are now optional; `hrefBuilder` wins when both are set). The existing
cursor-stack API is unchanged and back-compatible.

`productIds` mode of `buildProductQuery` (frequently-bought-together, curated rows) is **single-shot**:
it returns the whole finite set re-sorted to the requested id order, `hasNext/hasPrev=false`. No cursor
paging (there is nothing to page).

---

## §7. Firestore indexes — the full list for B6 to deploy

**Deploying is the user's action. Do NOT deploy.** B0 appended composite indexes to
`firebase/firestore.indexes.json`; run `firebase deploy --only firestore:indexes` from repo root.

### Already present (verified) — buildProductQuery reuses these, no action needed
The admin/app work already created every single-equality-set × sort index the website needs
(`status` is always pinned first). Covered combos on `products` (COLLECTION scope), each with sort
∈ {`createdAt` DESC, `minPrice` ASC, `maxPrice` DESC, `averageRating` DESC, `totalReviews` DESC}:
- `status` + sort
- `status` + `categoryId` + sort
- `status` + `categoryId` + `subCategoryName` + sort
- `status` + `isNewArrival` + sort
- `status` + `isFlashSale` + sort
- search: `status` + `keywords`(CONTAINS) + `createdAt` DESC
- reviews (PDP): `productId` + `isPublished` + `createdAt` DESC
- facets counts: served by the equality prefix of `status`+`categoryId`+`subCategoryName`+`createdAt`
- price bounds: served by `status`(+`categoryId`)+`minPrice`/`maxPrice`

Note: `priceDesc` orders by `minPrice` DESC and is served by the `status…minPrice` ASC index (an
equality-pinned prefix traverses either direction), so no separate `minPrice` DESC index is required.

### NEW — appended by B0 (8 indexes) — deploy these
Category page stacked with ONE quick filter, per sort field {`createdAt` DESC, `minPrice` ASC,
`averageRating` DESC, `totalReviews` DESC}. Fields: `status` ASC, `categoryId` ASC, `<flag>` ASC, `<sort>`:
- `status` + `categoryId` + **`isNewArrival`** + {createdAt | minPrice | averageRating | totalReviews} — 4
- `status` + `categoryId` + **`isFlashSale`** + {createdAt | minPrice | averageRating | totalReviews} — 4

### NOT pre-created — add if you build the screen
Deeper stacks are intentionally omitted to keep the index count bounded (Firestore caps at 200/db).
If a session builds one of these, append the matching index and note it here:
- **sub-category + a flag** (`status`+`categoryId`+`subCategoryName`+`isNewArrival|isFlashSale`+sort)
- **two flags at once** (`isNewArrival` AND `isFlashSale` together) — an unusual UX; avoid if possible.
- Any `productIds` (`documentId() in`) query needs **no** composite index (uses the built-in name index).

A missing composite index fails the query with `FAILED_PRECONDITION` — the Firebase console error links
the exact index to create. In dev the query throws with a create-index URL; append the JSON here rather
than clicking through, so B6 deploys them together.
