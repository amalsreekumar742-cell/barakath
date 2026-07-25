# Barakath

An Islamic ecommerce platform — customer website, customer mobile app, and an admin panel, all backed by a single Firebase project.

- **Currency:** ₹ INR (Indian Rupee)
- **Language:** English only

## Tech Stack

| Surface | Stack |
| --- | --- |
| **Admin panel** | React + Vite (TypeScript SPA), Redux Toolkit, Tailwind CSS v4 |
| **Customer website** | Next.js (App Router, TypeScript, SSR), Redux Toolkit, Tailwind CSS v4 |
| **Customer app** | Flutter (Dart), Provider, go_router |
| **Backend** | Firebase — Firestore, Auth, Storage, Cloud Functions (TypeScript), Hosting / App Hosting |
| **Payments** | Razorpay |
| **OTP / SMS** | MSG91 |

## Monorepo Layout

```
apps/
  admin/        React + Vite SPA (admin panel)
  web/          Next.js App Router (customer website)
  app/          Flutter (customer mobile app — NOT a pnpm workspace member)
packages/
  shared/       Framework-agnostic TypeScript shared library (@barakath/shared)
functions/      Firebase Cloud Functions (TypeScript)
firebase/       firestore.rules, firestore.indexes.json, storage.rules
docs/           specs (source of truth), skills, design prototypes (reference only)
```

The JS/TS apps are managed with **pnpm workspaces** + **Turborepo**. The Flutter app is Dart and lives outside the JS workspace.

## Prerequisites

- Node.js 20+ and **pnpm** (`npm i -g pnpm`)
- **Flutter** SDK (stable channel) for the mobile app
- **Firebase CLI** (`npm i -g firebase-tools`) for backend/deploys

## Setup

### 1. Web apps + shared + functions (pnpm)

```bash
# from the repo root
pnpm install
```

Copy each app's env template and fill in real values:

```bash
cp apps/admin/.env.example apps/admin/.env
cp apps/web/.env.example   apps/web/.env
```

Run the apps:

```bash
pnpm --filter admin dev     # React + Vite admin panel
pnpm --filter web   dev     # Next.js customer website
# or run everything wired through Turborepo:
pnpm turbo run dev
```

### 2. Customer app (Flutter)

```bash
cd apps/app
cp .env.example .env        # fill in Firebase config values
flutter pub get
flutter run
```

## Build

```bash
pnpm turbo run build        # builds admin, web, shared, functions
```

## Backend (Firebase)

- **Firestore rules / indexes / Storage rules** live in `firebase/` and are wired through the root `firebase.json`.
- **Admin (React + Vite)** → **standard Firebase Hosting**, serving `apps/admin/dist` (SPA rewrites configured). Enable the `webframeworks` experiment for auto-detected Vite deploys, or use the static `dist/` config in `firebase.json`.
- **Website (Next.js)** → **Firebase App Hosting** (SSR / Server Components need a server runtime). Configure via `apps/web/apphosting.yaml` and a connected App Hosting backend — it is intentionally **not** in the `firebase.json` `hosting` block.
- **Cloud Functions** deploy from `functions/`.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting:admin
```

## Secrets

- Only genuinely public Firebase web config uses `VITE_*` (admin) / `NEXT_PUBLIC_*` (web) — these ship to the browser.
- Server-only secrets (Razorpay key secret, MSG91 auth key, Firebase Admin credentials) live **only** in Cloud Functions / App Hosting env — never in a client env var, never committed.
- `.env*` is git-ignored except the committed `.env.example` templates.

## Documentation

- `docs/specs/` — the complete project specification (source of truth).
- `docs/skills/` — architecture/convention skill files (React/Next.js, Firebase Functions, Flutter).
- `docs/design/` — HTML prototypes for layout/styling reference only (not shipped, not built).
