# `src/app` — routing and the rendering rule

## The one rule

**Public catalog data is fetched on the server. Anything belonging to a specific person is fetched
in the browser.**

| | Server | Client |
|---|---|---|
| Fetched with | `src/lib/data/*` (Firebase Web SDK, `import 'server-only'`) | feature `api/` `createAsyncThunk`s |
| Reads | products, variants, categories, sub-categories, banners, published reviews, `general/config` | orders, wallet, wishlist, cart, affiliate, notifications, addresses, the user doc |
| Why | SEO and link previews need real HTML | it is per-user, non-indexable, and changes while you look at it |

### Why this is structurally enforced, not just documented

There is no Admin SDK in this app. `src/lib/data/serverFirestore.ts` uses the same **public** Firebase
config the browser uses, because `firestore.rules` grants `allow read: if true` on the catalog. It
therefore has exactly the permissions of a signed-out visitor.

A Server Component *cannot* read an order or a wallet — the attempt returns permission-denied. The
rule enforces itself.

`src/lib/data/*` starts with `import 'server-only'`, so a `"use client"` file that imports it fails
the **build**, not at runtime.

## Route groups

Groups shape rendering and chrome; they never appear in the URL.

```
(shop)/       Server Components + ISR, indexable.  revalidate = 300
              /  /categories  /category/[categoryName]  /product/[productId]
              /banner/[bannerId]  /search  /privacy-policy  /terms

(checkout)/   Client, auth-gated, noindex. Storefront flows that are not "account".
              /cart  /order-success  /payment-failed  /wishlist  /spin-win

(account)/    Client, auth-gated, noindex. Gets the account sidebar in Batch 4.
              /account/**

(auth)/       Client, no header chrome.
              /login
```

`(checkout)` is a **fourth** group beyond the three the Batch 1 prompt named. The prompt put `/cart`,
`/wishlist` and `/spin-win` under route protection but did not say which group they live in, and
they fit neither: they are not indexable catalog, and they must not inherit the account sidebar. A
separate group keeps `(account)/layout.tsx` free to be the sidebar shell without wrapping the cart
in it.

## Adding a route

1. Put it in the group that matches how it renders, not the one that matches its name.
2. `(shop)` pages export `revalidate` and `generateMetadata`.
3. `(checkout)`, `(account)` and `(auth)` pages inherit `robots: { index: false }` from their group
   layout — do not re-declare it, and do not remove it.
4. Add the path to `src/middleware.ts` if it needs a signed-in visitor.
