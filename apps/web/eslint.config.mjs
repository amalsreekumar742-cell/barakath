import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * ESLint for the customer website.
 *
 * WHY the boundary zones are the point of this file: four Batch 1 sessions and five Batch 2 sessions
 * write into `src/features/*` in parallel. The bulletproof-react rule that a feature may not import
 * another feature is the thing that keeps those sessions from silently coupling — and a rule nobody
 * enforces is a rule that lasts until the first deadline. These make it a lint error.
 *
 * WHY `src/stores` is exempt from the shared→features restriction: with Redux Toolkit the root store
 * IS the composition root and must import every feature's slice. That is the one legitimate
 * exception; feature slices still may not import each other, which the per-feature zones below cover.
 *
 * WHY the Firebase server/client split is NOT policed here: `src/lib/data/*` starts with
 * `import 'server-only'`, which fails the BUILD rather than the lint if a client component imports
 * it. A build error is stronger than a lint error — it cannot be committed past.
 */
const FEATURES = [
  'account',
  'address',
  'affiliate',
  'auth',
  'cart',
  'catalog',
  'checkout',
  'coupons',
  'notifications',
  'orders',
  'search',
  'spinner',
  'wallet',
  'wishlist',
];

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    /**
     * The Playwright E2E suite. Two rules are switched off here and ONLY here — both fire on things
     * that are correct in a test harness and would be wrong to "fix" in the code.
     *
     * `react-hooks/rules-of-hooks`: a Playwright fixture receives a callback conventionally named
     * `use` (`async ({}, use) => { await use(value) }`). The rule sees a call to `use(...)` outside a
     * component and reports React's `use` hook. Renaming the parameter is not an option — the name is
     * positional convention across every Playwright codebase and doc — and the file contains no React.
     *
     * `no-explicit-any`: `firebase-admin` is resolved at runtime out of `functions/node_modules`
     * (see e2e/fixtures/adminSdk.ts for why it is not a dependency of this app), so its types are not
     * available to the compiler here. Inventing hand-written interfaces for the Admin SDK surface
     * would be a second, silently-drifting copy of someone else's API.
     *
     * This block covers e2e/ only, so application code keeps both rules.
     */
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    rules: {
      /**
       * WHY `_`-prefixed arguments are exempt from no-unused-vars: a placeholder component that
       * must keep its final prop contract (Header, Footer) has a parameter it does not yet read.
       * Deleting the parameter would change the signature the next session is meant to implement;
       * the underscore says "deliberately unused" the way it does in Go and Rust.
       */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // 1) No cross-feature imports — one zone per feature.
            //    THREE deliberate exceptions, all one-directional:
            //    - `checkout` -> `address`: C2's brief explicitly requires reusing `features/address`'s
            //      AddressPicker/AddressForm/AddressCard components and its `useAddresses` hook as-is
            //      (checkout has no address UI/data of its own to duplicate them with, and there is no
            //      raw-action-type escape hatch for a component/hook import the way there is for a
            //      Redux action like `cart/clearCart`).
            //    - `checkout` -> `cart`: the design puts the full "Apply coupon" UI (`CouponPanel`) on
            //      the Checkout screen, but it dispatches `cartSlice`'s `applyCoupon`/`removeCoupon` and
            //      so stays Cart-feature-owned rather than duplicated.
            //    - `coupons` -> `account`: Batch 4's brief puts the shared `usePaginatedCollection`
            //      hook under `features/account/hooks` (every account-area list uses it) and requires
            //      `CouponWallet` (`features/coupons`) to paginate through it too, rather than a second
            //      copy of the same cursor-pagination logic. `usePaginatedCollection` has no account-
            //      specific logic in it (it is generic over any Firestore Query) — this is a folder-
            //      location artifact of the brief, not a real domain coupling.
            //    - `orders` -> `account`: same reason, same hook — the order history list pages
            //      through `usePaginatedCollection` too.
            //    - `wallet` -> `account`: same reason again (Batch 4 / D2) — the wallet ledger pages
            //      through `usePaginatedCollection` rather than a fourth copy of the same mechanics.
            //    None are reversed: `address`/`cart`/`coupons`/`orders`/`wallet` cannot reach back into
            //    `checkout`, and `account` cannot reach into any of them.
            ...FEATURES.map((feature) => ({
              target: `./src/features/${feature}`,
              from: './src/features',
              except:
                feature === 'checkout'
                  ? [`./${feature}`, './address', './cart']
                  : feature === 'coupons' || feature === 'orders' || feature === 'wallet'
                    ? [`./${feature}`, './account']
                    : [`./${feature}`],
              message:
                'A feature may not import another feature. Compose them at the app/route layer, ' +
                'or move the shared piece into src/components, src/lib or packages/shared.',
            })),

            // 2) Unidirectional flow: app -> features, never the reverse.
            {
              target: './src/features',
              from: './src/app',
              message: 'Features must not import from the app layer — the dependency runs one way.',
            },

            // 3) Shared modules may not reach into features or app.
            //    src/stores is deliberately absent: see the note above.
            {
              target: [
                './src/components',
                './src/hooks',
                './src/lib',
                './src/types',
                './src/utils',
                './src/config',
              ],
              from: ['./src/features', './src/app'],
              message:
                'Shared modules cannot depend on features or the app layer — that inverts the ' +
                'import direction and makes them unshareable.',
            },
          ],
        },
      ],
    },
  },
];

export default config;
