---
name: >-
  claude-firebase-functions-skill
description: >-
  Conventions for this monorepo's Firebase Cloud Functions — the trusted server tier (v2, TypeScript, Node, firebase-admin) behind the web and Flutter apps. Use when writing, reviewing, or scaffolding anything in the functions/ codebase, or when deciding whether work belongs on the server at all. Covers the feature-wise folder structure and wiring-only index.ts, the onCall-vs-onRequest choice (by who calls it), CORS defaults for onRequest, defineString params so a missing env value blocks deploy, the Admin-SDK trust boundary (verify the caller, never trust client identity or money, webhook HMAC, timing-safe compare, admin custom claim), Firestore from the server (serverTimestamp, increment/runTransaction, bounded queries, aggregations), HttpsError vs JSON error contracts, secrets handling, deployment, and per-feature commit policy. Use for backend/server logic; not for client React/Flutter UI or SEO — see their own skills.
---

# Firebase Cloud Functions — Claude Skill Rules

> **Scope note:** This document covers **Firebase Cloud Functions (v2, TypeScript, Node)** — the trusted server tier that sits behind a Next.js / React web app or a Flutter app. It is the backend-side sibling of the Flutter and Next.js+React skill docs: same monorepo philosophy, different tier. Rules here govern the `functions/` codebase only. Client-side rules (Redux, thunks, folder structure for UI) live in their own skill docs and are **not** repeated or contradicted here. If a project chooses a different backend (a bare Node server, Cloud Run container, another provider), these rules are not force-fitted onto it — follow that platform's own idioms instead.

## Project Context
- **Runtime:** Firebase Cloud Functions **v2** (`firebase-functions/v2/https`), Node **20+**, deployed via the Firebase CLI.
- **Language:** **TypeScript only** — every source file `.ts`, `strict: true`, compiled to `lib/` by `tsc`.
- **SDK:** `firebase-admin` (Admin SDK — full privileges, bypasses Security Rules) + `firebase-functions`.
- **Architecture:** **feature-wise folder structure** — one folder per feature, `index.ts` is wiring only.
- **Role:** Functions are the **trust boundary**. Anything privileged, financial, cross-user, or secret-dependent runs here — never on the client. Plain reads stay on the client (direct Firestore, gated by Security Rules).
- **Config:** `defineString` params (`firebase-functions/params`) — a missing value **blocks deploy** rather than failing at runtime.

---

## Folder Structure (Feature-based)

```
functions/
├── .env                     # actual param values — GIT-IGNORED, never committed
├── .env.example             # every key, blank values + a comment explaining each — COMMITTED
├── .gitignore               # must ignore: lib/, node_modules/, .env, *-adminsdk-*.json
├── package.json             # main: "lib/index.js"; engines.node pinned
├── tsconfig.json            # strict, rootDir: src, outDir: lib
└── src/
    ├── index.ts             # WIRING ONLY: initializeApp() + re-export every function
    ├── common/              # cross-feature helpers (auth verification, collection names)
    │   ├── auth.ts
    │   ├── verifyUserCaller.ts
    │   ├── verifyAdminCaller.ts
    │   └── collections.ts
    ├── scripts/             # one-off backfills / maintenance, NOT deployed exports
    └── features/
        └── <feature>/
            ├── <functionName>.ts   # the trigger + handler — one function per file
            ├── constants.ts        # defineString params + static constants for this feature
            ├── service/            # business logic — pure-ish, testable, no req/res
            ├── data/               # TS types for this feature's documents
            └── utils/              # helpers scoped to this feature
```

Rules:
- **One function per file**, named exactly as the file (`createBranch.ts` → `export const createBranch`). The exported name **is** the deployed function name and the URL — renaming it deploys a new function and orphans the old one.
- **`index.ts` is wiring only** — `admin.initializeApp()` at the very top, `setGlobalOptions`, then one `export { fn } from "./features/<feature>/<fn>"` line per function, grouped by feature with a comment. No logic, no handlers.
- **Include only the folders a feature needs.** A small feature may be a single `<functionName>.ts`.
- **`common/`** holds only what genuinely spans features (caller verification, collection names). A helper used by one feature lives in that feature's `utils/`.
- **`scripts/`** holds one-off backfills. They are **not** exported from `index.ts` — running them is a deliberate act, not a deploy.

### `index.ts` shape

```ts
import * as admin from "firebase-admin";
// initializeApp() must run before any other Firebase Admin call, so it lives at the very top.
admin.initializeApp();

import { setGlobalOptions } from "firebase-functions";

// Cap concurrent instances to protect quotas/cost; tune per function later if needed.
setGlobalOptions({ maxInstances: 10 });

// Wiring only: every real function lives in its own feature folder and is re-exported here so
// `firebase deploy` discovers it. Keep one export line per function, grouped by feature.
export { setAdminClaim } from "./features/admin/setAdminClaim";
export { createAdminMember } from "./features/roles/createAdminMember";
// Checkout: prices the caller's cart server-side — the client may read neither the coupon doc
// nor the redemption ledger it depends on.
export { validateCoupon } from "./features/checkout/validateCoupon";
```

---

## Layer Rules (handler → service → data/utils)

Import direction is strictly **utils/data → service → handler → index**:
- **`<functionName>.ts` (handler):** owns the trigger, CORS, auth gate, input validation, and the HTTP/callable response contract. It **translates** between the wire and the domain — it does not contain business logic.
- **`service/` (logic):** the actual work. Takes plain typed arguments, returns plain typed values, throws typed errors. **Never touches `req`/`res`** — that's what makes it testable and reusable across two functions.
- **`data/` (types):** TS interfaces for this feature's Firestore documents.
- **`utils/` (helpers):** pure functions scoped to this feature.
- A feature must **not** import another feature's `service/` internals. If two features need the same logic, it moves to `common/`. Sharing by reaching sideways is how two copies of a rule silently drift apart.

**WHY split handler from service:** the same logic is often needed by more than one entry point (an `onCall` from the app *and* a webhook *and* a backfill script). Logic that lives inside a handler can only ever be reached through that handler's wire format.

---

## Choosing a Trigger — `onCall` vs `onRequest`

This is the single most important decision per function. **Pick by who calls it, not by what it does.**

### `onCall` — for our own web/app clients (the default)

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";

/**
 * Assigns leads to executives for a branch.
 * WHY onCall (not onRequest): this is only ever invoked by our own admin SPA using the Firebase
 *   client SDK's httpsCallable(). The callable protocol hands us a verified `req.auth` with zero
 *   token-parsing code, handles CORS for us, and serializes errors the client SDK understands.
 *   There is no third party in the picture, so an open HTTP surface would be a liability.
 */
export const autoAssignShuffleLead = onCall(async (req) => {
  // req.auth is populated by the SDK from the caller's ID token — already verified. Never trust
  // a uid passed in req.data; it can say anything.
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const { branchId, leads } = req.data as { branchId: string; leads: LeadInput[] };
  if (!branchId) {
    throw new HttpsError("invalid-argument", "branchId is required");
  }
  return await assignLeadsToExecutives(branchId, leads.map((l) => l.id));
});
```

Use `onCall` when **the caller is our own project's web app or mobile app**, and:
- Auth comes free and verified — `req.auth.uid`, `req.auth.token.admin` — with no `Authorization` header parsing.
- CORS is handled by the callable protocol; no `cors` option needed.
- Errors go back as typed `HttpsError` codes the client SDK surfaces as `error.code` / `error.message`.
- The client calls it with `httpsCallable(functions, "fnName")(data)` — no URL to hardcode, no manual `fetch`.

**Throw `HttpsError`, never a bare `Error`.** A bare `Error` reaches the client as an opaque `INTERNAL` with the message stripped — the user sees nothing useful and the real reason is lost. Use the standard codes: `unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`, `failed-precondition`, `resource-exhausted`, `internal`.

### `onRequest` — for external / third-party callers

```ts
import * as functions from "firebase-functions/v2/https";
import { META_WEBHOOK_VERIFY_TOKEN } from "./metaConstants";

/**
 * Meta lead-ads webhook. GET verifies the subscription; POST receives lead events.
 * WHY onRequest (not onCall): Meta's servers call this. They speak plain HTTP with Meta's own
 *   body shape and hub.challenge handshake — they know nothing of the Firebase callable protocol,
 *   and there is no Firebase user to authenticate. A raw HTTP endpoint is the only thing that fits.
 * SECURITY: no Firebase auth exists here, so the endpoint authenticates the CALLER instead —
 *   the verify token on GET, and the X-Hub-Signature-256 HMAC on POST.
 */
export const metaWebhookTxproject = functions.onRequest({ cors: true }, async (req, res) => {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(req.query["hub.challenge"]);
      return;
    }
    res.status(403).send("Verification failed");
    return;
  }
  // ...POST: verify signature, then process
});
```

Use `onRequest` **only** when the caller is not our own Firebase-SDK client:
- **Webhooks** — payment gateways, Meta/WhatsApp, shipping providers, any third party pushing events at us.
- **OAuth redirect targets** — the provider redirects a *browser* here; it must be a real URL returning a redirect/HTML.
- **Ops tooling** — `curl` / scripts run by us, gated by a static bearer token (there is no signed-in user when provisioning the very first admin).
- **Anything needing a raw response** — a file download, a non-JSON body, a specific status/redirect the callable protocol can't express.

`onRequest` handlers **must** do by hand everything `onCall` gives free:
1. **Reject wrong methods** — `if (req.method !== "POST") return res.status(405)...`, so the endpoint isn't pokeable via a GET link.
2. **Authenticate the caller explicitly** — verify a webhook signature (HMAC), a static bearer token (timing-safe compare), or a Firebase ID token from the `Authorization: Bearer` header. **An unauthenticated `onRequest` is a public endpoint on the internet.**
3. **Validate every input** before touching the database.
4. **Return an explicit status + JSON shape**, documented in the function's doc comment.

### The rule, stated plainly
> **Called from our own web/app → `onCall`. Called from outside (webhooks, third parties, OAuth redirects, ops curl) → `onRequest`.**

If you find yourself writing `onRequest` + manual `Authorization: Bearer <idToken>` verification for a call that only ever comes from our own app, that should be an `onCall` — you are hand-rolling what the callable protocol already does correctly.

> **Legacy note:** older codebases predate this convention and use `onRequest` + Bearer verification nearly everywhere, including for calls that only ever come from their own app. Don't mass-migrate them — a deployed function's URL is a contract. Apply this rule to **new** functions; migrate an old one only when it's being rewritten anyway, and ship the client change in the same commit.

---

## CORS

- **`onCall` needs no `cors` option** — the callable protocol handles it.
- **`onRequest` disables CORS by default** — a browser call from our own origin fails until CORS is set. **Always pass a `cors` option to `onRequest`.**
- **Default to `{ cors: true }`** unless specific origins have been agreed. `cors: true` reflects the request origin — it permits cross-origin *browser* calls; it is **not** an auth mechanism and never guards anything.
- When the allowed origins are known, prefer them: `{ cors: ["https://app.example.com", "https://admin.example.com"] }`.
- **CORS is irrelevant to server-to-server callers.** A webhook from Meta or Razorpay is not a browser and sends no `Origin`; the setting neither helps nor hinders it. It's there for browser-initiated calls only.

```ts
export const validateCoupon = onRequest({ cors: true }, async (req, res) => { /* ... */ });
```

---

## Environment Variables — `defineString`

**Every environment value a function needs is declared with `defineString` from `firebase-functions/params`.**

```ts
// features/metaIntegration/metaConstants.ts
import { defineString } from "firebase-functions/params";

// Required Meta credentials.
// WHY defineString (not plain process.env): the CLI discovers these at deploy time and REFUSES TO
//   DEPLOY when a value is missing — the failure lands at deploy, in front of a developer, instead
//   of at 2am as a 500 on a live webhook. process.env silently yields undefined and ships broken.
// IMPORTANT: do NOT call `.value()` here (module/global scope). During deployment the Firebase CLI
//   loads & inspects function code before it has resolved parameter values; calling `.value()` in
//   global scope can cause deployment failures. Call it INSIDE the handler.
export const META_APP_ID = defineString("META_APP_ID");
export const META_APP_SECRET = defineString("META_APP_SECRET");

// Non-secret static config — plain constants, no param needed. These are public URLs, not secrets.
export const FRONTEND_URL = "https://txproject.web.app";
```

```ts
// Read it inside the handler — never at module scope.
export const metaInitiate = functions.onRequest({ cors: true }, async (req, res) => {
  const metaAppId = META_APP_ID.value();
  if (!metaAppId) {
    res.status(500).send("metaAppId not configured");
    return;
  }
  // ...
});
```

Rules:
1. **Declare params in the feature's `constants.ts`** (e.g. `metaConstants.ts`), one module per feature, exported. Not scattered across handlers.
2. **Never call `.value()` at module/global scope** — only inside a handler or a function called by one. Global `.value()` breaks deploys.
3. **Missing value = failed deploy.** That is the whole point: `defineString` makes an unconfigured secret a build-time error rather than a runtime 500. Never paper over it by falling back to `process.env.X ?? ""`.
4. **Every param gets a line in `.env.example`** with a blank value and a comment saying what it is, where to get it, and whether it's server-only:
   ```
   # msg91 server auth key — validates the OTP widget access-token.
   # SERVER-ONLY secret; never expose to the browser. From the msg91 dashboard.
   MSG91_AUTH_KEY=""
   ```
5. **Values live in `functions/.env`, which is git-ignored.** `.env.example` is committed; `.env` never is.
6. **Static non-secret config is a plain `const`,** not a param. A public URL or a fixed API version isn't configuration — making it a param adds a deploy-blocking requirement for nothing.
7. **`defineSecret`** (Secret Manager) is the stronger option for high-value secrets — it keeps the value out of the deployed function's environment and audits access. Use it for payment gateway secrets and signing keys where the project has agreed to it; `defineString` otherwise.

---

## Auth & the Trust Boundary

The Admin SDK **bypasses all Security Rules**. Every line in a function runs with full database privileges, so the function itself is the only thing standing between a caller and the data.

- **Never trust client-supplied identity.** A `uid`, `role`, `isAdmin`, or `branchId` in the request body is an *assertion*, not a fact. Derive the caller from `req.auth.uid` (`onCall`) or a verified ID token (`onRequest`) — never from input.
- **Never trust the client for money.** Recompute every price, discount, and total server-side from documents the server reads itself. A function that accepts a `subtotal` or `amount` from the client accepts whatever the client felt like sending.
- **Authenticate first, work second.** The auth gate is the first thing in the handler, before validation, reads, or logging of inputs.
- **Fail closed.** A missing secret, an unparseable token, an unexpected shape → reject. A verification helper that can't decide returns `null`/`false`, and the handler maps that to a 401/403.
- **Timing-safe compare for static secrets.** `===` on a token leaks how many leading characters matched via response timing — use `crypto.timingSafeEqual` (guard lengths first).
- **Verify webhook signatures.** A webhook URL is public. Without an HMAC check (`X-Hub-Signature-256`, `X-Razorpay-Signature`), anyone who learns the URL can forge events — fake payments, fake leads.
- **The admin boundary is a custom claim** (`admin: true`), set server-side via `setCustomUserClaims` and checked from the verified token. Never "which app opened the page".
- **Permission checks are separate from the admin check.** Being an admin is not being *this* admin — check the specific permission too when the project has a role model.

Shared verification helpers live in `common/` and return the caller's uid or `null`:

```ts
// common/verifyUserCaller.ts
/**
 * Verifies the Firebase ID token on an incoming request and returns the caller's uid (or null).
 * WHY verify the token (not trust a uid in the body): endpoints act on the CALLER'S OWN doc, so
 *   the server must derive identity from something it can cryptographically trust — client input
 *   could target another user's doc.
 * WHY it returns null (not throws): the caller maps null → 401 and fails closed.
 */
export async function verifyUserCaller(req: Request): Promise<string | null> {
  const header = req.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    return (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}
```

---

## Firestore Rules Inside Functions

- **`Timestamp` for time fields.** `createdAt`/`updatedAt` are written with `FieldValue.serverTimestamp()` — the server's clock, never a function's or client's. Types use `Timestamp` from `firebase-admin/firestore`, never `number`.
  > A `Timestamp` can't cross HTTP as a class instance. When a function returns a document over JSON, either omit the timestamp and let the client stamp its own optimistic entry, or serialize it explicitly (`.toMillis()`) and document that in the response contract.
- **Atomic writes, never read-modify-write.** `FieldValue.increment(...)` for blind counters (usage tallies, view counts); `runTransaction` when the write depends on the current value (decrement stock only if `stock >= qty`). A plain read-then-write races under concurrent requests and oversells.
- **Collection names come from `common/collections.ts`** — a typo'd string literal creates a new empty collection instead of erroring.
- **Every query is bounded.** `.limit()` on every non-aggregate query, no exceptions. An unbounded `.get()` on a growing collection is a memory blowout and a bill.
- **Aggregations use `getCountFromServer` / `getAggregateFromServer`** — never fetch-all-and-count.
- **Batch writes cap at 500 operations.** Chunk larger sets; `BulkWriter` for big backfills.
- **Search fields use `keywordsBuilder`** (shared with the client — same implementation, or the two disagree about what matches).

---

## Error Handling & Response Contracts

**`onCall`** — throw `HttpsError` with the right code; the client SDK reads `code`/`message`:
```ts
throw new HttpsError("failed-precondition", "That coupon has expired.");
```

**`onRequest`** — explicit status + a documented JSON shape, always `{ error: string }` on failure:
```ts
res.status(400).json({ error: "Enter a coupon code." });
```

- **Wrap the whole handler in try/catch.** An unhandled throw in `onRequest` becomes an opaque 500 with no log context.
- **`logger.error("fnName failed", err)`** on every catch — `firebase-functions`' logger, not `console.log`, so entries are structured and searchable in Cloud Logging.
- **Two audiences, two messages.** The response carries a message a *user* can act on ("That email is already registered."); the log carries the real error. Never leak stack traces, internal ids, or secret-adjacent detail to the client.
- **Map known error codes to clean statuses** — `auth/user-not-found` → 404, `auth/email-already-exists` → 400, anything unrecognized → 500.
- **Never log secrets or tokens** — not the auth key, not the ID token, not the webhook body if it carries credentials.
- **Document the contract in the doc comment** — method, body shape, required header, and every status the function returns.

---

## Comment Every Function

Every exported function and every service function gets a doc comment stating **(a) what it does** and **(b) why this approach instead of the alternatives**. No rationale = incomplete.

For a Cloud Function specifically, the "why" must answer:
- **Why `onCall` or `onRequest`** — who calls this?
- **Why it's server-side at all** — what stops the client doing it? (rules deny the read, it needs a secret, it's money, it needs the Admin SDK)
- **How the caller is authenticated** — and what happens when they aren't.

```ts
/**
 * Validates a coupon code against the caller's own cart and returns what it is worth.
 *
 * WHY a Cloud Function for what is only a PREVIEW: `coupons` is admin-read in firestore.rules (a
 *   targeted coupon's userIds name other customers), so the client can't read the code's discount;
 *   and eligibility depends on `couponRedemptions`, the money ledger, which is admin-read-only.
 * WHY it takes only `{ code }` and reads the cart itself: the discount is computed from the cart's
 *   subtotal, so accepting lines (or a subtotal) from the client would let a tampered request
 *   inflate its own basis. The caller is authenticated; the server fetches the cart it already owns.
 * WHY it does NOT record a redemption: applying a coupon is not spending it — the customer may edit
 *   their cart or leave. placeOrder writes the redemption in the same transaction as the order.
 *
 * This is a preview, NOT the authority: placeOrder re-runs every check and recomputes the discount
 * at commit. A customer who forced a "valid" response here still cannot spend the coupon.
 *
 * Request: POST { code: string }  ·  Header: Authorization: Bearer <idToken>
 * Response 200: { code, title, discountPaise, subtotalPaise }
 * Response 400: { error } — invalid/expired/used code, or an empty cart (customer-facing message)
 */
```

---

## Package-First Policy

Before writing an implementation from scratch, check whether a well-maintained package already solves it. Prefer the package when it's actively maintained, widely used, and doesn't drag in a huge dependency tree for a small need.

Pre-approved for common needs:
- **`axios`** — outbound HTTP to third-party APIs.
- **`cors`** — only when the built-in `cors` option can't express the policy; the option covers almost everything.
- **`xlsx`** (`npm:@e965/xlsx`) — Excel import/export. The `@e965` fork is the maintained one; the original `xlsx` on npm is stale and carries advisories.
- **`firebase-functions-test`** — unit-testing functions offline.
- **`dotenv`** — only if a project reads `.env` directly; `defineString` params are preferred and don't need it.

Don't add a package for something the Admin SDK or Node stdlib already does (`crypto` for HMAC/timing-safe compare, `fetch` for simple calls).

---

## Deployment

```
npm run build            # tsc → lib/    (predeploy hook runs this)
firebase deploy --only functions
firebase deploy --only functions:validateCoupon    # single function — faster, safer
firebase functions:log
```

- **`firebase.json` declares the codebase** with a `predeploy` build hook, so a deploy can never ship stale `lib/`:
  ```json
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20",
      "ignore": ["node_modules", ".git", "*.local"],
      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
    }
  ]
  ```
- **Pin `engines.node`** in `package.json` to match `runtime` in `firebase.json`. A mismatch fails deploy or, worse, runs on a runtime you didn't test.
- **`disallowLegacyRuntimeConfig: true`** — keeps the project on params and off the deprecated `functions.config()`.
- **Deploy a single function while iterating** (`--only functions:name`). A full deploy redeploys everything and multiplies the blast radius of a mistake.
- **`setGlobalOptions({ maxInstances: 10 })`** in `index.ts` caps runaway scaling and cost; raise per-function only where the load justifies it.
- **Test against the Emulator Suite** before deploying — `firebase emulators:start --only functions,firestore,auth`. Functions run with full privileges; a bug found in the emulator is free, and the same bug found in production may have already written.
- **Deleting an export deletes the deployed function** on the next full deploy, and its URL dies with it. Commenting one out has the same effect. Check for callers first.

---

## Git Commit Policy (Mandatory per Feature)

**Build → test → commit → push**, one coherent feature per commit, Conventional Commits.

### What counts as a completed feature
- The function is written, its service logic is separated, and it's exported from `index.ts`.
- It builds clean (`npm run build`, no TS errors).
- It's been exercised against the emulator (or deployed and hit) — not just compiled.
- `.env.example` documents any new param.
- Its doc comment states what/why/auth and the response contract.

### What does NOT count
- A handler with a `// TODO: verification for post request` where the auth gate belongs.
- A function that compiles but has never been called.
- Commented-out functions left in place "for later".

### Git rules
- Never commit `.env`, service-account JSON keys, or `lib/`.
- Never commit a function whose auth gate is unfinished. A deployed unauthenticated endpoint is public the moment it exists — that is not a "fix it in the next commit" situation.
- Don't commit secrets in test fixtures or logs.

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Function file | `camelCase.ts`, matches the export | `validateCoupon.ts` |
| Exported function | `camelCase`, verb-first, **is the deployed name** | `createAdminMember` |
| Feature folder | `camelCase` | `metaIntegration/` |
| Service file | `camelCase` + role suffix | `adminMemberService.ts` |
| Params (`defineString`) | `SCREAMING_SNAKE_CASE`, matches the `.env` key | `META_APP_SECRET` |
| Static constants | `SCREAMING_SNAKE_CASE` | `META_REDIRECT_URI` |
| Types/interfaces | `PascalCase` | `AdminMemberRecord` |
| Collection keys | `camelCase`, in `common/collections.ts` | `couponRedemptions` |

Function names are permanent-ish: the export name becomes the deployed name and the public URL. Name it once, properly. Spelling matters — a typo'd name (`excutiveLeadsAssign` for `executiveLeadsAssign`) is stuck until someone is willing to break every caller.

---

## Secrets

**Never commit secrets.** Not in source, not in `.env`, not in a JSON key file, not in a test fixture.

- Server-only secrets (auth keys, payment gateway secret, webhook signing secret, WhatsApp token) live in `functions/.env` (git-ignored) or Secret Manager — **never** in `NEXT_PUBLIC_*` / `VITE_*`, which ship to every browser.
- **`.gitignore` must cover** `.env`, `*-adminsdk-*.json`, and any `serviceAccount*.json` **before** the first commit that could touch them.
- **A Firebase Admin service-account JSON is never needed in `functions/`.** Deployed functions get credentials automatically from `admin.initializeApp()` with no arguments. A key file in the repo is a full-privilege credential in version control.
- **If a secret is committed, rotating it is the fix, not deleting it.** Git history keeps the old value, and so does every clone and fork.
- `.env.example` is the contract: every key, blank value, a comment saying what it is and where it comes from.

---

## When generating code, Claude should:

1. Write **TypeScript only**, `strict`, fully typed — no `any`.
2. Put each function in **`src/features/<feature>/<functionName>.ts`**, one function per file, export name matching the file name.
3. Keep **`index.ts` as wiring only** — `initializeApp()` first, `setGlobalOptions`, then one re-export per function, grouped by feature with a comment.
4. Use **`onCall`** when the caller is our own web/app — read identity from `req.auth`, throw `HttpsError` with a real code, never a bare `Error`.
5. Use **`onRequest`** only for webhooks, OAuth redirects, ops tooling, or raw-response needs — and then hand-roll the method check, the caller authentication, and the documented status/JSON contract.
6. Pass **`{ cors: true }` to every `onRequest`** unless specific origins are agreed (CORS is off by default and browser calls will fail without it). Never pass `cors` to `onCall`. Never treat CORS as auth.
7. Declare **every env value with `defineString`** in the feature's `constants.ts`, and **never call `.value()` at module scope** — only inside the handler.
8. Add every new param to **`.env.example`** with a blank value and a comment; never fall back to `process.env.X ?? ""` to dodge a missing value.
9. **Authenticate first, work second** — the auth gate is the first thing in the handler, and it fails closed.
10. **Never trust client-supplied identity or money** — derive the uid from the verified token, recompute every amount server-side from documents the server reads itself.
11. **Verify webhook signatures** (HMAC) on every third-party `onRequest`. A webhook URL is public.
12. Use **`timingSafeEqual`** for static-token comparison, guarding lengths first.
13. Keep **business logic in `service/`**, taking plain typed args and returning plain typed values — never `req`/`res`.
14. Write **`FieldValue.serverTimestamp()`** for `createdAt`/`updatedAt`, typed as `Timestamp` from `firebase-admin/firestore`, never `number` — and serialize explicitly (or omit) when returning them over JSON.
15. Use **`FieldValue.increment`** for blind counters and **`runTransaction`** for value-dependent writes — never client-side or function-side read-modify-write.
16. Put **`.limit()` on every non-aggregate query**, use `getCountFromServer`/`getAggregateFromServer` for counts, and chunk batches at 500.
17. Reference collections through **`common/collections.ts`**, never a string literal.
18. Wrap handlers in **try/catch**, log with **`logger.error("fnName failed", err)`**, return a user-actionable message while keeping internals in the log.
19. **Comment every function** with what it does and **why this approach over the alternatives** — including why `onCall`/`onRequest`, why it's server-side, and how the caller is authenticated.
20. Document the **request/response contract** (method, body, header, every status) in the handler's doc comment.
21. Put one-off backfills in **`scripts/`** and never export them from `index.ts`.
22. **Never commit** `.env`, service-account JSON, or `lib/` — and never add a service-account key to `functions/` at all; `initializeApp()` needs no arguments.
23. Test against the **Emulator Suite** before deploying, and deploy single functions (`--only functions:name`) while iterating.
24. **Ask before renaming or deleting a deployed function** — the export name is the public URL, and removing an export deletes the function.

---

## Notes
- Functions are the trust boundary, not a convenience layer. If a piece of work could safely run on the client, it probably should — a direct Firestore read gated by Security Rules is faster and cheaper than a function round-trip. Functions exist for what the client must **not** be allowed to do.
- The Admin SDK bypasses Security Rules entirely. Rules protect the client path only; they will not save a function from a missing auth check.
- The cost of a mistake here is asymmetric. A bug in the UI shows a wrong number; a bug here writes a wrong number, charges a real card, or opens a public endpoint to a database with no rules in front of it.
