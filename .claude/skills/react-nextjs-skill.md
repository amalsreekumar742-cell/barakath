---
name: >-
  claude-react-nextjs-skill
description: >-
  Architecture and conventions for this monorepo's TypeScript web apps — Next.js (App Router) storefronts and React + Vite (SPA) admin panels on Firebase. Use when writing, reviewing, or scaffolding web-app code, or when deciding where a file goes, choosing a package, or wiring Firestore/auth. Covers bulletproof-react feature folders and unidirectional imports, Redux Toolkit slices + thunks, Firestore reads (cursor pagination, aggregation queries, Timestamp fields, onSnapshot), the client-vs-Cloud-Function trust boundary for privileged/financial writes, Tailwind v4 @theme tokens, loading/skeleton + empty/error states, the shared Modal and keywordsBuilder, pre-approved packages, image crop→compress→upload, Firebase hosting per app type, and the per-feature build→test→commit→push cycle. Not for Flutter apps or Cloud Functions internals — see their own skills.
---

# Next.js + React (Vite) Web — Claude Skill Rules

> **Scope note:** Everything in this document (bulletproof-react folder structure, Redux Toolkit, Firestore-reads-in-thunks, the unidirectional import rules, the specific packages listed) is **web-stack-specific guidance** for **TypeScript React apps**. It applies whenever an app in this monorepo is built with **Next.js** (App Router) or **React + React Router on Vite**. If a different stack is chosen for an app (see "Multi-App Monorepo Structure" → always ask in chat first), this web doc's rules do NOT get force-fitted onto that stack — instead follow that stack's own idiomatic, well-established architecture and best practices (e.g. a Flutter app follows Clean Architecture with Provider/get_it/dartz, not a bulletproof-react folder structure). This is the web-side sibling of the Flutter skill doc: same monorepo philosophy, different stack.

## Project Context
- **Framework:** **Next.js (App Router)** for customer-facing apps · **React + React Router (Vite SPA)** for admin/back-office apps.
- **Language:** **TypeScript only** — every source file `.ts`/`.tsx`, fully typed.
- **Architecture:** [bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) feature-based folder structure, **unidirectional imports** (shared → features → app).
- **State Management:** Redux Toolkit (RTK) — `createSlice` + `createAsyncThunk`.
- **Backend:** Firebase (Firestore, Storage, Cloud Functions, Hosting/App Hosting as applicable).
- **Data access:** Firestore reads live **inside `createAsyncThunk`** (feature `api/`); no separate abstract repository layer.
- **Error handling:** RTK thunk lifecycle (`pending`/`fulfilled`/`rejected`) — errors surface as explicit slice state, never thrown raw into the UI.
- **Styling:** **Tailwind CSS v4** (CSS-first — no `tailwind.config` file) — design tokens defined in the global CSS via `@theme`, never inline hex.

---

## Folder Structure (Feature-based, bulletproof-react)

```
src/
├── app/                     # application layer (routing + providers); framework-specific — see below
├── assets/                  # static files (images, fonts) shared across the app
├── components/              # shared components used app-wide (Button, Modal, DataTable, Skeleton)
├── config/                  # global config: Constants object, cloudFunctionUrls, exported env vars
├── features/                # feature-based modules (see below)
│   └── <feature>/
│       ├── api/             # data access: Firestore read thunks + Cloud Function fetch wrappers
│       ├── assets/          # static files scoped to this feature
│       ├── components/      # components scoped to this feature
│       ├── hooks/           # hooks scoped to this feature
│       ├── stores/          # this feature's RTK slice(s): createSlice + extraReducers
│       ├── types/           # TS types used within this feature (XxxProps)
│       └── utils/           # utility functions for this feature
├── hooks/                   # shared hooks used across the app
├── lib/                     # preconfigured reusable libraries (firebaseConfig, toast, http client)
├── stores/                  # global Redux store setup + app-wide slices (currentUser, ui, appConfig)
├── testing/                 # test utilities and mocks
├── types/                   # shared TS types used across the app
└── utils/                   # shared utility functions
```

Stack-specific notes:
- **`lib/`** holds `firebaseConfig.ts` (exports `auth`, `db`, `storage`, `functions`), the configured toast, and any preconfigured client helper — the "preconfigured libraries" bulletproof describes.
- **`stores/`** holds the RTK store (`configureStore`, typed `RootState`/`AppDispatch`, `useAppSelector`/`useAppDispatch`) plus **app-wide slices** (current user, UI modals, app config). Feature-scoped slices live inside their feature.
- **`config/`** holds the `Constants` object (app identity, third-party widget ids, storage keys, thresholds) and `cloudFunctionUrls`. Collection names / enums come from `packages/shared` (see Multi-App section).
- Include **only the folders a feature actually needs** — a small feature may have just `components/` + `stores/`.

### The `app/` layer differs per framework
- **Next.js (App Router):** `src/app/` **is** the App Router — it owns routes, layouts, `loading.tsx`, `error.tsx`, `metadata`. Route segments compose feature `components/`. Global providers (Redux `<Provider>`, toast) go in `src/app/providers.tsx` (a client component) wrapped by the root `layout.tsx`. Prefer Server Components for catalog/SEO; mark interactive islands `"use client"`.
- **React + Vite:** `src/app/` holds `app.tsx` (root), `provider.tsx` (Redux + router providers), `router.tsx` (React Router config), and `routes/` (route elements, **lazy-loaded** for code-splitting). Route elements are thin — they render feature `components/` and guard privileged access.

---

## Layer Rules (unidirectional: shared → features → app)

Import direction is strictly **shared → features → app**:
- **Shared modules** (`components`, `hooks`, `lib`, `stores`, `types`, `utils`, `config`, and the `packages/shared` package) can be imported **anywhere**.
- **Features** may import from shared modules **only** — a feature must **not** import from another feature or from `app`.
- **The `app` layer** may import from features and shared modules. Cross-feature composition is wired **at the app/route layer**, not by one feature reaching into another.
- **Import files directly — no barrel (`index.ts`) re-exports** (better tree-shaking).

### Feature-internal layering (data → state → UI)
- **`api/` (data access):** Firestore **read** operations as `createAsyncThunk`s (the query lives here), plus `fetch()` wrappers around Cloud Functions. No UI here; this is the only place that touches Firebase for reads.
- **`stores/` (state):** the feature's RTK slice — `createSlice` with `extraReducers` handling `pending/fulfilled/rejected` of the thunks from `api/`.
- **`components/` (UI):** listens to state via `useAppSelector`, triggers actions via `dispatch`. **UI never calls Firebase directly** — always go through a thunk. No business logic inside `useEffect`/render.

### ESLint enforcement (`import/no-restricted-paths`)
Add zones so the rules are enforced, not just documented — one cross-feature block per feature:

```js
'import/no-restricted-paths': [
  'error',
  {
    zones: [
      // 1) Disable cross-feature imports (one block per feature):
      { target: './src/features/auth',     from: './src/features', except: ['./auth'] },
      { target: './src/features/products',  from: './src/features', except: ['./products'] },
      // ...one per feature...

      // 2) Enforce unidirectional flow: app -> features (not the reverse)
      { target: './src/features', from: './src/app' },

      // 3) Shared modules cannot import from features or app.
      //    EXCEPTION: ./src/stores is omitted — with RTK the root store is the composition
      //    root and must import each feature's slice. Feature slices themselves still may not
      //    import other features (rule 1 keeps that in check).
      {
        target: ['./src/components', './src/hooks', './src/lib', './src/types', './src/utils', './src/config'],
        from: ['./src/features', './src/app'],
      },
    ],
  },
],
```

---

## Firebase-Specific Rules
- All Firebase reads live inside `features/<feature>/api/` as `createAsyncThunk`s; import `db` from `lib/firebaseConfig`. UI and shared components never query Firestore directly.
- Map docs to typed domain objects (`{ ...d.data(), id: d.id } as XProps`) — components never see raw `DocumentData`.
- Keep Firestore collection/field name strings as constants in `packages/shared/config` (`FirestoreCollections`), never inline `'products'`/`'orders'`.
- **Use the Firestore `Timestamp` type (`import { Timestamp } from 'firebase/firestore'`) for date/time fields (`createdAt`, `updatedAt`, `deletedAt`, …) — never a plain `number` (epoch millis).** Type them as `Timestamp` in `XxxProps`, write them with `serverTimestamp()` (or `Timestamp.now()`, both from `firebase/firestore`), `orderBy('createdAt', 'desc')` on the native field, and convert to a JS `Date` at the edge with `.toDate()` for display/formatting. WHY: `Timestamp` preserves nanosecond precision, sorts and range-queries correctly server-side, and `serverTimestamp()` stamps the authoritative server clock (immune to a wrong client clock) — a `number` epoch loses that and invites client-clock skew.
- **Mandatory pagination / lazy loading:** any Firestore query that returns a list MUST be cursor-paginated — never fetch an entire collection.
  - Use `orderBy(...) + limit(PAGE_SIZE) + startAfter(cursor)` (cursor-based), **not** offset-based (Firestore has no offset; offset-style re-reads skipped docs and bills for them).
  - The thunk accepts a page cursor, returns `{ items, lastVisible, hasMore }`; the slice appends new items and **dedups by id** (StrictMode / rapid scroll can dispatch the same page twice).
  - `hasMore = items.length === PAGE_SIZE` (full page ⇒ probably more; short page ⇒ end reached).
  - **NEVER read a collection without a `limit()`. Zero exceptions.** A paginated list uses `limit(PAGE_SIZE)`; a bounded config/lookup read uses a sane cap (e.g. `limit(500)`) with a comment saying why. An unbounded `getDocs(collection(...))` is a bug, even for a collection that "can't be big".
  - Always expose a **"View More" / load-more control** while `hasMore` (a customer app may also use infinite scroll). Applies to **every** list/grid — even ones that seem small.
  - Default page size **12** (a named constant — one place to tune per screen). Assess item weight: heavy image cards → lower end (10), light single-line rows → higher (15); 12 is the balanced default.
  - A **growable-option dropdown** uses a custom paginated dropdown (cursor-paged, 12 + View More + client filter), **not** a native `<select>` (which can't host a "View More"). Only a tiny, bounded, curated set may load once via a single capped read.

  ```ts
  /**
   * Fetches the next page of active products in a category, cursor-paginated.
   * WHY the query lives in the thunk: keeps Firestore access with the state that owns it and
   *   avoids an indirection layer we don't need for reads.
   * WHY startAfter(lastVisible): Firestore has no offset; this reads only the next PAGE_SIZE docs
   *   instead of re-reading skipped ones (lower billing).
   * WHY `lastVisible: any`: the cursor is a QueryDocumentSnapshot; typing it as `any` here is the one
   *   accepted `any` — it never leaves the store, only fed back to startAfter.
   */
  export const fetchProductsPage = createAsyncThunk(
    'products/fetchPage',
    async ({ categoryId }: { categoryId: string }, { getState }) => {
      const state = getState() as { products: ProductsState };
      const current = state.products.byCategory[categoryId] || { lastVisible: null };
      const q = query(
        collection(db, FirestoreCollections.products),
        where('categoryId', '==', categoryId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        ...(current.lastVisible ? [startAfter(current.lastVisible)] : []),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ ...d.data(), id: d.id })) as ProductProps[];
      return { categoryId, items, lastVisible: snap.docs[snap.docs.length - 1] || null, hasMore: items.length === PAGE_SIZE };
    },
  );
  ```

- **Mandatory aggregation queries for sum/count/average:** whenever a screen needs a sum, count, or average over a collection/query (dashboard KPIs, report totals), use Firestore [Aggregation Queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) — `getCountFromServer` / `getAggregateFromServer` with `sum()` / `average()`. **Never** fetch the full set and total client-side.
  - Why: aggregations are computed server-side and only the single summary value is transmitted — billed as a small fixed number of index entries scanned, not one read per document. This keeps billing minimal.
  - Keep these in a thunk like any other read, exposing a plain `number`.

  ```ts
  // Count — e.g. total active products
  const countSnap = await getCountFromServer(
    query(collection(db, FirestoreCollections.products), where('status', '==', 'active')),
  );
  const activeCount = countSnap.data().count;

  // Sum — e.g. today's revenue
  const sumSnap = await getAggregateFromServer(
    query(collection(db, FirestoreCollections.orders), where('createdAt', '>=', startOfDay)),
    { total: sum('grandTotal') },
  );
  const todaysRevenue = sumSnap.data().total;
  ```

- **Search = a precomputed `keywords: string[]` field, built with the shared `keywordsBuilder`.** Firestore has no case-insensitive "contains", so any searchable collection stores a lowercased keyword array built from every searchable field (name, email, phone…) **when the doc is written** (server-side), and queried with `where('keywords', 'array-contains', term.trim().toLowerCase())` + the same cursor pagination. `array-contains` + `orderBy` needs a composite index — add it to `firestore.indexes.json`. Never scan-and-filter client-side. Use the shared **`keywordsBuilder`** utility (see "Reusable Building Blocks") to generate the array — reuse it across almost all projects rather than re-writing keyword logic per collection.

### Real-time listeners (`onSnapshot`)
- **Default to one-shot paginated `getDocs` thunks.** Reach for `onSnapshot` only when a screen genuinely needs live data — most importantly the **current authenticated user's own document** (so profile, role/claims mirror, wallet, cart, addresses stay live across tabs/devices), plus order-status timelines, admin dashboard figures, and live stock. Real-time reads bill a document read per change, so don't use them where a one-shot fetch suffices.
- **A listener is a subscription, not a one-shot promise — it does NOT belong in `createAsyncThunk`.** Put it in a small custom hook (feature `hooks/` or an app-level `useCurrentUser`) that subscribes on mount, dispatches a plain slice action on each snapshot, and returns the `unsubscribe` for cleanup on unmount — otherwise you leak listeners and double-dispatch.
- **Subscribe to the current user doc once, high in the tree** (right after auth resolves), writing into the app-wide `currentUser` slice — every feature reads it from Redux instead of re-fetching. Re-subscribe when the auth uid changes; unsubscribe on sign-out.
- **Still bound listener queries** with `where(...)` + `limit(...)` — an unbounded listener streams the whole collection and every future change (billing + memory blow-up). Same discipline as paginated reads. Never stack a listener and a paginated `getDocs` on the same data.

  ```ts
  // src/hooks/useCurrentUser.ts — live subscription to the signed-in user's own document.
  // WHY a hook (not a thunk): onSnapshot is a long-lived subscription with a lifecycle; createAsyncThunk
  //   resolves once. The hook owns subscribe/cleanup and just dispatches the slice action on each update.
  // WHY the current-user doc specifically: role/claims, wallet, cart and profile change server-side (admin
  //   actions, other tabs) — a live doc keeps the app in sync without manual refetching after every mutation.
  export function useCurrentUser(uid: string | null) {
    const dispatch = useAppDispatch();
    useEffect(() => {
      if (!uid) return;                                            // signed out — nothing to watch
      const unsub = onSnapshot(doc(db, FirestoreCollections.users, uid), (snap) => {
        dispatch(setCurrentUser(snap.exists() ? { ...snap.data(), id: snap.id } : null));
      });
      return unsub;                                                // unsubscribe on unmount / uid change
    }, [uid, dispatch]);
  }
  ```

### Reads vs. writes — the trust boundary
- **Reads:** direct client Firestore (as above), gated by Security Rules.
- **Privileged / sensitive / cross-user / financial writes go through an authenticated Cloud Function** (`Authorization: Bearer <idToken>`), **not** direct client `setDoc`/`updateDoc`. The client can't be trusted to write totals, payment status, stock counts, rewards, or another user's data; routing through a function lets the server validate the caller and enforce invariants Security Rules alone can't express.
- Low-risk, self-owned, non-financial writes (e.g. wishlist under the user's own doc) may write directly **if** Security Rules fully constrain them.
- **Never trust the client for money** — recompute all prices, discounts, totals, and payment amounts server-side.
- **Concurrent counters / stock use atomic operations, never read-modify-write.** Inside the Cloud Function, bump counters with **`FieldValue.increment(...)`** (blind increments — coupon-usage, analytics tallies, view counts) and use **`runTransaction`** when the write depends on the current value (e.g. decrement stock only if `stock >= qty`, reject otherwise). WHY: a plain read-then-write races under concurrent orders and oversells / double-counts; `increment()` and transactions are applied atomically server-side. Reserve/decrement stock, redeem coupons, and grant referral rewards this way — one transaction per order.

---

## State Management — Redux Toolkit
- **One store per app** in `src/stores/`, with typed `RootState`/`AppDispatch` and typed `useAppSelector`/`useAppDispatch` (never untyped).
- **Slices live inside their feature** (`features/<feature>/stores/<feature>Slice.ts`) and are registered in the root store. App-wide slices (current user, UI modals, app config) live in `src/stores/`.
- **`createAsyncThunk` holds Firestore reads** (in `features/<feature>/api/`) and `fetch()` calls to Cloud Functions; the slice handles `pending/fulfilled/rejected` explicitly (loading/error live in the slice, never inferred from `data == null`).
- Import the thunk from `../api` into the slice's `extraReducers`; never define the query inside the slice.
- Persist cart/guest-only state with `redux-persist` to `localStorage` where needed; store ids + qty + selection, **not** trusted prices.
- Derived preview values (subtotals, counts) via memoized `createSelector`; authoritative totals still come from the server.
- Components `dispatch` + `useSelector` only — no business logic inside `useEffect`/render.

---

## Data Fetching & Error Handling (replaces dartz `Either`)
- Every thunk has an explicit lifecycle in the slice: `pending` → set `loading = true`, clear error; `fulfilled` → set data, `loading = false`; `rejected` → set `error`, `loading = false`.
- Every fetchable slice exposes explicit, named state: **`loading | error | empty | data`** — never inferred from null-checks alone.
- **Exceptions are caught at the boundary** (inside the thunk or its `rejected` handler) and converted to a serializable error string on the slice — a raw exception must never reach the component. Components render off the slice's `error`/`empty`/`loading` fields.
- Always handle both success and failure paths in the UI: an error state with a **retry**, and an explicit **empty** state.

---

## Reusable Building Blocks (carry across projects)

Two pieces are reused in **almost every project** — don't re-implement them per project; copy/import the canonical versions and adapt only the styling.

### Reusable `Modal` component (`src/components/Modal.tsx`)
Build **one** portal-based modal and reuse it for **every** dialog/pop-up (confirm dialogs, forms, image viewers, game/offer modals) — never hand-roll a modal per screen. It renders through `ReactDOM.createPortal` into `document.body` (so it escapes overflow/stacking-context traps), dims + blurs the backdrop, closes on outside-click, and carries the baseline accessibility a dialog is expected to have: **Escape-to-close, background scroll-lock, focus moved into the dialog on open and restored to the trigger on close, and `role="dialog"`/`aria-modal`**. Reference shape:

```tsx
// src/components/Modal.tsx — the ONE reusable modal; reuse for every dialog/pop-up.
// WHY a portal: renders at document.body so the overlay escapes parent overflow/z-index/stacking
//   contexts — a modal nested in a scrolled/clipped container would otherwise be cut off.
// WHY outside-click via a ref boundary (not a backdrop-only onClick): a click that starts inside the
//   panel but drags out shouldn't dismiss; checking panelRef.contains(target) closes only on a true outside click.
// WHY the effect: Escape-to-close + body-scroll-lock + focus move/restore are baseline a11y a dialog
//   must have, not extras — without them the background scrolls under the modal and keyboard/focus is lost.
import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxWidth?: string;            // Tailwind width cap for the panel, e.g. 'max-w-lg'
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, maxWidth = 'max-w-lg', children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    lastFocused.current = document.activeElement as HTMLElement; // remember the trigger to restore later
    document.body.style.overflow = 'hidden';                     // lock background scroll while open
    panelRef.current?.focus();                                   // move focus into the dialog
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';                         // release scroll lock
      lastFocused.current?.focus();                              // restore focus to the trigger
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-[999]"
      onClick={(e) => {
        e.stopPropagation();
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`w-full ${maxWidth} outline-none animate-fade-in`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
```

> For a fully keyboard-accessible dialog you can also add a **Tab focus-trap** (cycle Tab/Shift-Tab within the panel); the above covers Escape, scroll-lock, and focus move/restore — add the trap when a modal has many focusable controls.

### Shared `keywordsBuilder` utility (`packages/shared/src/utils/keywordsBuilder.ts`)
The canonical searchable-keywords generator, reused across almost all projects (ported from the team's Dart version). It expands a string into all lowercased, punctuation-stripped **prefix substrings** (and word-shifted variants) so Firestore `array-contains` gives prefix/"starts-with" search. Store the result in a doc's `keywords: string[]` field **when the doc is written** (server-side), then query as described in "Firebase-Specific Rules → Search".

```ts
// packages/shared/src/utils/keywordsBuilder.ts — generate the `keywords: string[]` search field.
// WHY prefix substrings: Firestore has no case-insensitive "contains"; precomputing every prefix
//   lets `array-contains` match partial/starts-with queries with a single indexed lookup.
function keywordsBuilder(value: string): string[] {
  const list: string[] = [];
  const parts = value.split(' ');
  for (let i = 0; i < parts.length; i++) {
    let name = '';
    for (let k = i; k < parts.length; k++) name += `${parts[k]} `;
    let temp = '';
    for (let j = 0; j < name.length; j++) {
      temp += name[j];
      list.push(temp.toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s/g, ''));
    }
  }
  return Array.from(new Set(list.filter((e) => e !== '')));
}

export default keywordsBuilder;
```

---

## Package-First Policy (Use Existing Package vs. Build from Scratch)

**Rule:** Before writing custom code for a common need, first check for a simple, well-maintained package. Only build from scratch if none fits.

Order of preference: (1) reuse a package already in the workspace `package.json`; (2) reach for a pre-approved package below; (3) only if nothing fits → build custom, and briefly explain why.

### General packages used in almost every project (reach for these by default)
- **Toasts:** `react-hot-toast` — all success/error feedback.
- **Forms + validation:** `react-hook-form` (+ `zod` for schema validation) — every non-trivial form.
- **Loading skeletons:** `react-loading-skeleton` — mandatory for fetch loading (see Loading State Policy).
- **Date pickers:** `react-datepicker` — any date / date-range input.
- **Icons:** `lucide-react` — the icon set; use it instead of ad-hoc inline SVGs or copy-pasted icon markup.

### Other pre-approved packages for common needs
- **State:** `@reduxjs/toolkit` + `react-redux`; `redux-persist` for persisted/guest state.
- **Routing (Vite SPA):** `react-router-dom` (lazy routes). Next.js apps use the App Router.
- **Tables / data grids:** `@tanstack/react-table`.
- **Charts:** `recharts` (dashboards/reports).
- **Dates (formatting/math):** `date-fns`.
- **Image cropping:** `react-advanced-cropper` — crop/rotate/aspect-ratio UI before upload.
- **Image compression:** `browser-image-compression` — shrink/resize the image client-side before uploading to Cloud Storage.

### Image upload flow (crop → compress → upload)
Any image upload (product photos, avatars, banners, review photos) should go through: **pick → crop (`react-advanced-cropper`) → compress (`browser-image-compression`) → upload to Cloud Storage → store the download URL on the Firestore doc.** Compress on the client so Storage holds right-sized assets and pages load fast; crop first so the stored asset already matches the target aspect ratio. Wrap the cropper in the shared `Modal`, and the upload button follows the Button-Loading rule (disabled + spinner from click through upload complete).

### When generating code, Claude should also:
- Reach for the **general packages** above by default (toasts, forms, skeletons, date pickers) — they're expected in almost every project; don't hand-roll a toast system, form-state manager, skeleton, or date picker.
- For any image upload, use `react-advanced-cropper` + `browser-image-compression` (crop → compress → upload) rather than uploading a raw file or building a cropper from scratch.
- For any other common need (tables, charts, date math) prefer the matching package above (or one already in `package.json`) instead of writing it from scratch.
- If a pre-approved package genuinely doesn't fit, briefly explain why before falling back to custom.
- Verify the package is still current and add it to the **correct workspace** `package.json` with a pinned version before using it.

---

## Loading State Policy (Mandatory)

**Rule:** Whenever data is being fetched (Firestore reads, Cloud Function calls, pagination "load more"), the UI MUST show a proper loading placeholder — never a bare blank screen, and avoid a plain centered spinner for list/content screens.

- **Skeleton matching the real layout** (`react-loading-skeleton` or Tailwind skeletons) for list/grid/detail screens — the skeleton mirrors the actual card/row shape so it never goes out of sync.
- **Initial load** (first page / first fetch): full-screen skeleton matching the real layout.
- **Pagination "load more"**: a small skeleton at the **bottom of the list** while `loadingMore` is true — not a full-screen loader.
- **Next.js:** use `loading.tsx` / `<Suspense fallback={<Skeleton/>}>` for route/streamed segments.
- Loading/error/data must come from the slice as **explicit named state** (`loading | error | empty | data`), never inferred from null-checks.
- Use `react-hot-toast` for success/error feedback.

### Button loading (server-side actions)
Any button that triggers a server-side (async) operation MUST: set a loading boolean **on click**, be `disabled` while loading (prevents double-submit), show visible feedback (spinner or "Saving…"), reset in a `finally` block, and use `disabled:opacity-50 disabled:cursor-not-allowed`. Disable related inputs where a mid-flight change would corrupt the request. Pure-navigation / local-toggle buttons don't need this.

---

## Hosting & Deployment (Firebase)

**When Firebase is the deploy target, the two app types use two different Firebase hosting products — don't mix them up:**

| App | Hosting product | Why |
|---|---|---|
| **Next.js (App Router)** | **Firebase App Hosting** | Next.js is a full framework with a server runtime (SSR, Server Components, route handlers, `metadata`, ISR). App Hosting runs the Next.js server (containerized, Cloud Run backed) — a plain static bucket can't serve SSR. |
| **React + Vite (SPA)** | **Firebase Hosting** (standard) | A Vite SPA builds to static assets (`dist/`) with no server runtime; standard Firebase Hosting serves them from the CDN + does SPA rewrites — no App Hosting needed. |

### React + Vite → standard Firebase Hosting
- **Enable the experimental `webframeworks` feature** so Firebase auto-detects the Vite project and its build/output directory — no manual `public: "dist"` wiring or SPA rewrite config needed:
  ```bash
  firebase experiments:enable webframeworks
  firebase init hosting        # detects the Vite app; picks up `dist/` and SPA rewrites automatically
  firebase deploy --only hosting
  ```
- With `webframeworks` on, Firebase reads the Vite config, runs the build, and serves the output directory by default — this is the easy path for React-Vite deploys; prefer it over hand-writing `firebase.json` `public`/`rewrites`.
- Without the experiment, fall back to manual config: `"public": "dist"` + a catch-all rewrite (`{ "source": "**", "destination": "/index.html" }`) so client-side routing works on refresh.

### Next.js → Firebase App Hosting
- Deploy via App Hosting (a backend connected to the repo / `apphosting.yaml`), which builds and runs the Next.js server — keeping SSR, Server Components, route metadata, and streaming (`loading.tsx`/`<Suspense>`) working. Don't try to force a Next.js app onto standard static Hosting unless it's a fully static export (`output: 'export'`), which forfeits SSR/Server Components.

### Shared
- In a monorepo, both apps' hosting configs live in the one root `firebase.json` (one `hosting` target per app, plus the App Hosting backend); one `functions/` codebase deploys alongside. Keep server secrets in Cloud Functions/App Hosting env, never in the client bundle.
- **Confirm the deploy target in chat** if it isn't Firebase (Vercel/Netlify/Cloudflare change the Next.js hosting story) before wiring deployment config.

---

## Version Update Notifier (admin dashboards)

Long-lived admin/dashboard tabs stay open for days, so a user can run a stale bundle long after a new deploy. Add a **Firestore-driven version notifier** that compares the shipped bundle version against a version field in Firestore and prompts a hard refresh when the server is newer. This is **recommended for admin apps** (customer storefronts, which are visited fresh, usually don't need it — confirm before adding one there).

### How it works
1. Ship the bundle's version as a constant — `Constants.WEB_VERSION` (a semver string, bumped each deploy).
2. Keep a version field in a Firestore config doc (e.g. `dashboardWebVersion`) read into an app-wide slice (`generalData`).
3. Mount a single **`WebVersionUpdateNotifier`** component at the app root. It compares the remote version to `Constants.WEB_VERSION` (**semver-aware** — parse to numeric parts, compare left-to-right, treat missing/invalid as "not newer") and, when the remote is strictly newer, shows a **persistent `react-hot-toast`** (`duration: Infinity`, stable toast id) with a **"Refresh now"** action.
4. "Refresh now" does a **cache-busting hard reload** — `window.location.replace` with a fresh `_reload=<timestamp>` query param — so the browser fetches the latest bundle instead of a cached one. Dismissing the toast is allowed; it re-appears while the versions still differ.

```tsx
// src/components/WebVersionUpdateNotifier.tsx — mount once at the app root.
// WHY Firestore-driven: the team controls rollout from one backend field and a long-open admin
//   tab learns about a new deploy in real time, straight from the version doc it already reads.
// WHY semver-parse (not string compare): "1.10.0" > "1.9.0" is false as strings; numeric part
//   comparison gets ordering right and safely no-ops on missing/invalid values.
// WHY cache-busting replace(): a plain reload may serve the cached bundle; a unique query param
//   forces a fresh fetch of the newest deploy.
function isServerVersionNewer(remote?: string | null): boolean {
  const parse = (v: string) => v.trim().replace(/^v/i, '').split('.').map(n => parseInt(n, 10));
  const r = remote ? parse(String(remote)) : null;
  const l = parse(Constants.WEB_VERSION);
  if (!r || r.some(Number.isNaN) || l.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0, b = l[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}
// On "Refresh now": window.location.replace(url with ?_reload=Date.now())
```

- Bump `Constants.WEB_VERSION` as part of the deploy, and update the Firestore version field when a new build is live (ideally from CI or an admin action) so clients pick it up.

---

## Git Commit Policy (Mandatory per Feature)

**Rule:** Every completed feature goes through a strict **Build → Test → Commit → Push** cycle before the next feature. Never start new work on top of untested or un-pushed code.

```
Feature code complete
       ↓
   build (tsc / next build / vite build — compile + type check)
       ↓
   test (Vitest + React Testing Library; emulator/mocks — never production Firestore)
       ↓
   ✅ Pass → git add + commit + push
       ↓
   Next feature

   ❌ Fail → fix → re-test → then commit + push
```

### Why
- Prevents loss of working code, keeps history clean/reviewable/bisectable, makes rollbacks trivial, and catches bugs at the source before they enter the repo.

### Testing rules
1. After a feature's code is complete (api thunk → slice → components wired up), write/update its test **before committing** — the test is part of the feature, not an afterthought.
2. **Stack:** **Vitest + React Testing Library** for component/slice tests; optionally Playwright/Cypress for true E2E. Test files mirror the source (`features/<feature>/**` → co-located `*.test.ts(x)` or `src/testing/`).
3. **Minimum per feature:** component renders (key elements present); happy path (fetch → list shows items / submit → success state); **empty** and **error** states; **pagination** (initial page + load-more triggers next page + bottom skeleton); **navigation** (item → detail, back).
4. Cover money-critical / pure logic (totals, discounts) directly as unit tests where it lives (e.g. `packages/shared/src/utils`).
5. **Firebase in tests:** use the **Firebase Emulator Suite** or mocks — **never** production Firestore.
6. **Run tests before committing**; if a test fails, fix and re-run — do not commit until green. Existing tests must still pass (fix regressions first).

### Git rules
1. After tests pass: `git add` → `git commit` (Conventional Commits) → `git push`.
2. **Commit format:** [Conventional Commits](https://www.conventionalcommits.org/) — `feat(cart): …`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`. Include the module in parentheses.
3. **Do NOT batch multiple features into one commit.** A feature spanning sub-layers (api → slice → components) can be one commit; two separate features must not share a commit.
4. **Do NOT proceed to the next feature until the push succeeds.** Resolve push failures first.
5. Bug fixes and refactors also get their own test-commit-push cycle.

### What counts as a "completed feature"
- A new screen/page with its full stack (api thunk → slice → components) **plus its test**.
- New functionality on an existing screen (filter, action, integration) **plus updated/new test**.
- A bug fix that changes behaviour **plus a test verifying it**.
- A refactor that preserves behaviour — existing tests must still pass.
- Adding/updating Firestore security rules, indexes, or Cloud Functions.

### What does NOT count (don't commit mid-work)
- A half-wired feature (slice exists, components don't).
- Generated/scaffold files alone with no code using them.
- Feature code without its test.

---

## Multi-App Monorepo Structure

**Rule:** Multiple apps (e.g. a customer app + an admin app) are created inside a **single root project folder (monorepo)** — not split into separate repositories. Each app's stack is decided **per project** — **before generating any code for a given app, ask in chat which stack that app should use** (Next.js, React+Vite, Flutter, …); never assume by default.

```
project-root/                     # workspace-based: pnpm workspaces + Turborepo recommended
├── apps/
│   ├── web/                      # e.g. Next.js customer app — bulletproof src/ inside
│   └── admin/                    # e.g. React + Vite admin SPA — bulletproof src/ inside
│
├── packages/
│   └── shared/                   # framework-agnostic TS shared by BOTH TS/React apps
│       └── src/
│           ├── types/            # domain types (Product, Order, ...) — XxxProps
│           ├── config/           # FirestoreCollections, enums (OrderStatus, ProductStatus, ...)
│           ├── utils/            # pure math (price/discount), formatters, validators, keywordBuilder
│           └── assets/           # brand asset used by BOTH apps (one canonical file)
│
├── functions/                    # Cloud Functions (custom-token, verify, triggers, privileged writes)
│   └── src/
│
├── firebase/                     # ONE shared backend config
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
│
├── firebase.json
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

### Rules
- No stack is assumed by default. **Ask which stack each app should use before scaffolding it.** Once confirmed, stick to it for all subsequent generations unless told otherwise.
- **Shared code differs from a mixed-stack monorepo:** because both web apps are TypeScript/React, shared domain **types**, **collection names**, and **pure math** are defined **once** in `packages/shared` and imported by both apps + functions — never define `Order`/`Product` twice. (If an app were on a different stack, e.g. Flutter, code can't be shared across languages and the two sync only through the data contract.)
- `packages/shared` may be imported anywhere but must **never** import from any app (stays framework-agnostic) — enforce at the monorepo level.
- **One** `firestore.rules` / `firestore.indexes.json` / `storage.rules`; **one** `functions/` codebase — shared by every app.
- All apps connect to the **same Firebase project** — Firestore documents, collections, and field names stay identical across whichever apps read/write them.
- The **admin ↔ customer security boundary is enforced server-side** via Firestore Security Rules + an `admin:true` custom claim — never by which app opened the page. Never assume either app alone keeps data safe.

---

## Naming Conventions
- **Files:** components `PascalCase.tsx`; hooks `useX.ts`; slices `<feature>Slice.ts` (in `stores/`); api thunks/services `fetchProductsPage.ts` (camelCase, focused, default/named export, in `api/`); types in the feature's `types/`.
- **Types/interfaces:** `PascalCase` with a `Props` suffix for data shapes (`ProductProps`, `OrderProps`).
- **Redux:** slice name = feature (`products`, `cart`); thunks `verbNoun` (`fetchProductsPage`, `createOrder`).
- **Routes/URLs:** kebab-case (`/order-tracking`, `/products/[slug]`).
- **Constants:** `SCREAMING_SNAKE_CASE` for primitive constants; `PascalCase` objects for grouped config (`Constants`, `FirestoreCollections`).

---

## Assets & Design Constants

Static assets and design tokens are referenced through dedicated, centralized sources — never hardcode raw asset paths, `#RRGGBB`, font strings, collection names, or function URLs inside `features/`.

| Concern | Where it lives | Referenced as |
|---|---|---|
| Colors, fonts, spacing (design tokens) | global CSS `@theme { … }` (Tailwind v4, CSS-first) | Tailwind classes / CSS vars |
| Icons / images (URL-referenced) | app `public/` (or imported from `src/assets` / feature `assets/`) | `import icon from '...'` or `/public` path |
| Brand asset used by BOTH apps (logo) | `packages/shared/src/assets/` | `import logo from '@shared/assets/logo.webp'` |
| App identity, widget ids, thresholds, storage keys, links | `src/config/constants.ts` → `Constants` object | `Constants.xxx` |
| Firestore collection names | `packages/shared/src/config/collections.ts` → `FirestoreCollections` | `FirestoreCollections.xxx` |
| Domain enums (statuses, categories, discount types) | `packages/shared/src/config/enums.ts` | `OrderStatus.xxx`, `ProductStatus.xxx` |
| Cloud Function endpoint URLs | `src/config/cloudFunctionUrls.ts` → `cloudFunctionUrls` | `cloudFunctionUrls.xxx` |

```ts
// packages/shared/src/config/collections.ts — single source of truth for collection names
export const FirestoreCollections = {
  users: 'users',
  products: 'products',
  orders: 'orders',
} as const;

// src/config/constants.ts — app identity, config values, third-party ids, links, thresholds
export const Constants = {
  APP_NAME: 'My Store',
  PAGE_SIZE: 12,                    // default cursor page size
  DEFAULT_COUNTRY_CODE: '+91',
  STORAGE_KEY_CART: 'cart',
} as const;

// src/config/cloudFunctionUrls.ts — one entry per deployed function
export const cloudFunctionUrls = {
  createOrder: 'https://createorder-xxxx-uc.a.run.app',
} as const;
```

### Rules
- **Design tokens → Tailwind v4 CSS-first `@theme`** (there is **no `tailwind.config.js/ts`**), used via Tailwind classes; **never inline `#RRGGBB`** or ad-hoc font strings. Wire palette/typography from the design file (Figma variables/styles) once, in the global CSS. Setup: `@tailwindcss/vite` plugin for the Vite admin, `@tailwindcss/postcss` for the Next.js app; the global stylesheet does `@import "tailwindcss";` then declares tokens:
  ```css
  /* src/index.css (Vite) or src/app/globals.css (Next.js) */
  @import "tailwindcss";

  @theme {
    --color-primary: #1a1a1a;
    --color-accent:  #c8912f;
    --font-display:  "Inter", sans-serif;
  }
  ```
  A `--color-primary` token is then usable as `bg-primary` / `text-primary` etc. (Only drop back to a legacy `tailwind.config.ts` via the `@config` directive if a third-party plugin still requires it — otherwise stay CSS-first.)
- `FirestoreCollections` holds every collection name — datasources reference `FirestoreCollections.xxx`, never inline `'users'`/`'orders'`, so renaming is a one-line change.
- `cloudFunctionUrls` holds deployed function URLs (one per function); called from a feature's `api/` fetch wrapper, never inlined in components.
- **Secrets/API keys never belong as plain literals** in `Constants` or any committed file — see Secrets below.
- When adding any new collection/enum/config/color/function-URL usage, **add it to the relevant source first**, then reference it — never inline a literal in a widget or thunk.

### Secrets & Environment Variables
- Client-exposed public values: `NEXT_PUBLIC_*` (Next.js), `VITE_*` (Vite) — Firebase web config, public widget ids. Understand they ship to the browser.
- Server-only secrets (auth keys, payment secret, WhatsApp token, Firebase Admin service account) live **only** in Cloud Functions config/server env — never in a `NEXT_PUBLIC_`/`VITE_` var, never committed.
- `.env*` (except `.env.example`) is git-ignored; keep a committed `.env.example` per app. Never paste a real secret into source — reference the env var and flag it must be set at deploy time.

---

## When generating code, Claude should:
1. Write **TypeScript only**, fully typed (`XxxProps` for data shapes); avoid `any` except the Firestore cursor snapshot, and localize it.
2. Always place new code in the correct layer/folder per the bulletproof-react structure above; respect unidirectional imports (features never import other features; no barrels).
3. **Comment every function** with (a) what it does and (b) **why this approach vs. the alternative** (cost/security/correctness/UX/future-proofing) — no rationale = incomplete.
4. Never let UI call Firebase directly — reads go through a `createAsyncThunk` in `features/<f>/api/`; privileged writes go through an authenticated Cloud Function.
5. Do Firestore reads inside `createAsyncThunk` using the canonical cursor-pagination + dedup pattern; import `db` from `lib/firebaseConfig`; use `FirestoreCollections.*`.
6. **Paginate every list** — 12 per fetch + an always-present "View More" (`startAfter` + `limit(12)`, `hasMore = len === PAGE_SIZE`); refuse an unbounded `.get()` for list screens. Applies to every list/grid, even small ones. Use a paginated custom dropdown for growable option pools, not native `<select>`.
7. Use **aggregation queries** (`getCountFromServer`/`getAggregateFromServer`) for all counts/sums/averages; refuse a client-side loop-and-sum.
8. Route **privileged / financial / cross-user writes through an authenticated Cloud Function** (Bearer idToken); direct writes only for fully rule-constrained self-owned non-financial data. Recompute all money server-side.
9. Keep the RTK slice inside its feature (`stores/`), register it in the root store; handle `pending/fulfilled/rejected` explicitly; expose `loading|error|empty|data` as named state — never inferred from `data == null`.
10. **Skeleton** loading for every fetch (`react-loading-skeleton`/Tailwind; `loading.tsx`/`<Suspense>` in Next.js) — full skeleton on initial load, small bottom skeleton on load-more; never a bare spinner/blank screen. `react-hot-toast` for feedback.
11. **Every server-side-operation button** gets a loading state on click + disabled while loading (`disabled={loading}`, spinner/text, reset in `finally`, `disabled:opacity-50 disabled:cursor-not-allowed`, disable related inputs).
12. **Tailwind v4 only** (CSS-first `@theme`, no `tailwind.config` file); colors/fonts from the `@theme` tokens in global CSS; never inline hex or ad-hoc font strings.
13. In Next.js prefer Server Components for catalog/SEO with `"use client"` islands, `loading.tsx`/`<Suspense>`, per-page `metadata`. In React+Vite use React Router lazy routes + a privileged-access route guard.
14. **Never inline** a collection name, enum value, route, config value, function URL, or color — add/reuse it in `packages/shared/config` / `src/config` / the global CSS `@theme` first, then reference it.
15. Reach for the **general packages** used in almost every project by default — `react-hot-toast` (feedback), `react-hook-form` (+`zod`) (forms), `react-loading-skeleton` (loading), `react-datepicker` (date inputs), `lucide-react` (icons) — and the other pre-approved ones (RTK, `react-router-dom`, `recharts`, `@tanstack/react-table`, `date-fns`) before building from scratch; add to the correct workspace; explain if going custom.
16. Reuse the shared building blocks instead of re-implementing them: the portal-based **`Modal`** in `src/components/` for **every** dialog/pop-up, and the shared **`keywordsBuilder`** in `packages/shared/src/utils/` to build every searchable collection's `keywords` field.
17. Keep files focused (one service/slice/component per file); move a type/helper to `packages/shared` the moment both apps need it.
18. **Never commit secrets**; server secrets stay in Cloud Functions/env; only genuinely-public keys use `NEXT_PUBLIC_*`/`VITE_*`; keep `.env.example` current.
19. **Mandatory test + git push per feature:** after a feature's code, (a) write/update its Vitest/RTL test (emulator/mocks, never prod Firestore), (b) pass build + all tests, (c) commit (Conventional Commits) + push — before the next feature. The test is part of the feature. Never build on untested/un-pushed work.
20. Before scaffolding a new app or switching an app's stack, **ask in chat first** — don't assume a stack for an unconfirmed app, and don't silently change an existing app's setup.
21. When deploying on Firebase, use the right hosting product per app — **Next.js → App Hosting** (server runtime for SSR), **React+Vite → standard Firebase Hosting** with the experimental **`webframeworks`** feature enabled (`firebase experiments:enable webframeworks`) so the Vite `dist/` + SPA rewrites are auto-detected. Confirm the deploy target if it isn't Firebase.
22. For image uploads, run **crop (`react-advanced-cropper`) → compress (`browser-image-compression`) → upload to Cloud Storage → store the URL** — never upload a raw picked file; wrap the cropper in the shared `Modal` and gate the upload button with the Button-Loading rule.
23. Type Firestore date/time fields (`createdAt`, `updatedAt`, …) as **`Timestamp`** (`from 'firebase/firestore'`), never `number` — write with `serverTimestamp()`, sort on the native field, `.toDate()` only at the display edge.
24. Use **`onSnapshot`** (in a custom hook that dispatches to Redux and cleans up on unmount, not a thunk) for genuinely live data — above all the **current auth user's own document** into the `currentUser` slice — and for concurrent counters/stock use **`FieldValue.increment`** / **`runTransaction`** in the Cloud Function, never client read-modify-write.

---

## Notes
- This doc is set for **Redux Toolkit** + **Firestore-reads-in-thunks**. If a project later moves to react-query/zustand or a different data layer, update the relevant sections.
- A starter role-based `firestore.rules` (default-deny; public read for public docs; user-scoped reads; `admin:true` claim gate; server-only mutation of money/status/rewards) belongs at `firebase/firestore.rules`.
- This is the **web-stack sibling** of the Flutter skill doc: same monorepo philosophy (one Firebase backend, one data contract, per-app stack chosen explicitly), each following its own stack's idioms — never force-fit one onto the other.
- This file is meant to be used as a **Claude Skill / Project Knowledge** file so Claude follows this structure for every suggestion in a web-stack codebase.
