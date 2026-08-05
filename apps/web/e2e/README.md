# Storefront E2E suite

Playwright tests for `apps/web`, run against a **real Firebase project** (there is no emulator
setup in this repo). Two viewport projects — `desktop` (1440×900) and `mobile` (Pixel 7) — because
the storefront has a genuinely different mobile layout and a regression in one is invisible from the
other.

```bash
pnpm --filter web test:e2e            # headless, both viewports
pnpm --filter web test:e2e:ui         # interactive
pnpm --filter web test:e2e:headed     # watch the browser
pnpm --filter web test:e2e -- --project=mobile
```

The config attaches to an already-running `next dev` (`reuseExistingServer`). That is deliberate:
running `next build` while `next dev` holds `.next` corrupts the directory, so the suite must never
start a competing server behind you.

## What runs without any credentials

| Spec | Covers |
|---|---|
| `guest-browse.spec.ts` | home, categories, PDP, search, guest gating on protected routes, 404 |
| `mobile-shell.spec.ts` | bottom tab bar, login sheet, no horizontal overflow, full-bleed PDP gallery, sticky-CTA clearance |

## What needs an Admin SDK service account

Everything signed-in, plus the notification fan-out check:

| Spec | Covers |
|---|---|
| `signed-in-purchase.spec.ts` | real session, add to bag, cart persistence, checkout reaches payment |
| `signed-in-orders.spec.ts` | order appears in My Orders, order detail, cancel → server state |
| `signed-in-wallet-affiliate.spec.ts` | wallet balance, top-up recorded server-side, wallet offered at checkout, affiliate gating and earnings |
| `notification-fanout.spec.ts` | `onNotificationSend` dispatches, does not double-send, leaves scheduled ones alone |

These **skip with an explicit reason** rather than failing when no credential is present, so a skip
is never mistaken for a pass.

### Why a service account is required

Signing a customer in means minting a Firebase **custom token**. In production that token comes from
the `verifyOTP` Cloud Function after an MSG91 SMS — and a test runner cannot receive a text message.
Only the Admin SDK can mint the same artefact. Faking it is not an option: `middleware.ts` checks
only that the session cookie is *present*, so a forged cookie would get past the route guard and then
every Firestore read would fail against Security Rules — a test that walks through the front door and
silently renders empty screens is worse than no test at all.

The service account is also what lets a spec set up its **own preconditions** — a customer with a
known wallet balance, an order in a known state — instead of hoping production data happens to suit.

### Generating one

1. Firebase Console → ⚙️ **Project settings** → **Service accounts**
2. **Generate new private key** → download the JSON
3. Save it **outside the repository** (e.g. `C:\keys\barakath-e2e.json`)
4. Point `apps/web/.env.e2e` at it:

```ini
E2E_SERVICE_ACCOUNT=C:\keys\barakath-e2e.json
```

Treat that file like a password: it bypasses all Security Rules. Never commit it, never paste it into
a ticket, and revoke it from the same console screen if it leaks.

## The test customer

Signed-in specs share **one** identity, `+919999900001` (override with `E2E_CUSTOMER_PHONE`), created
on first run and reused after. Its `users/` document carries `isE2E: true`, which production code
never sets — that flag is what makes cleanup safe to automate.

The number is in the `+91 99999` range, which is not allocated to real subscribers, so a stray SMS
from a misconfigured run cannot reach anyone.

Specs run **serially** (`workers: 1`) because they mutate that one customer's wallet and orders;
parallel workers would fight over the same balance.

## Deliberate boundaries

**Razorpay payment completion is not automated.** Checkout hands off to Razorpay's hosted iframe — a
third-party origin with its own bot defences and its own test UI. Driving it would be testing
Razorpay, and it would break whenever they restyle. What the suite asserts is *our* side of the
handoff: that the server created a real order and recorded the amount it was opened for, and that
the paid states behave correctly (covered by seeding order documents in the shape
`createPaymentOrder` writes).

**Destructive admin actions stay in the admin suite, read-only.** `apps/admin/e2e` runs against live
data, so it asserts that refund and withdrawal-approval controls exist and are gated behind a
confirmation — it never actually moves money. Money-moving assertions belong here, against the
seeded E2E customer, where the amounts are fictional.
