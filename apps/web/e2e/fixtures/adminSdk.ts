import { readFileSync } from 'node:fs';
import path from 'node:path';
import { serviceAccountPath } from './env';

/**
 * Admin SDK access for the E2E suite — test setup and teardown only, never application code.
 *
 * WHY `firebase-admin` is resolved out of `functions/node_modules` instead of being added to
 * `apps/web`'s dependencies: the storefront deliberately ships NO service account (see
 * `src/app/api/session/route.ts` — the session cookie is a redirect hint, and Firestore Rules are the
 * real boundary). Adding firebase-admin to the web package would put a privileged SDK one careless
 * import away from application code. The functions package already depends on it for exactly the
 * privileged work it is meant for, so the test harness borrows it from there.
 *
 * `apps/web` is a CommonJS package, so this uses `require` + `__dirname` rather than
 * `import.meta.url` (which is an ESM-only construct and is what `apps/admin`'s ESM config uses).
 */

const functionsModules = path.resolve(__dirname, '../../../../functions/node_modules');

function resolveFrom(id: string): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(require.resolve(id, { paths: [functionsModules] }));
}

export interface AdminHandles {
  auth: any;
  db: any;
  FieldValue: any;
  Timestamp: any;
  projectId: string;
}

let cached: AdminHandles | null = null;

/**
 * Initialise the Admin SDK from the configured service account.
 * Throws if no credential is configured — every caller sits behind a `hasAdminCredentials()` guard,
 * so reaching here without one is a bug in the suite rather than an operator mistake.
 */
export function admin(): AdminHandles {
  if (cached) return cached;

  const keyPath = serviceAccountPath();
  if (!keyPath) {
    throw new Error(
      'admin() called with no service account configured — guard the caller with hasAdminCredentials()',
    );
  }

  const { initializeApp, cert, getApps } = resolveFrom('firebase-admin/app');
  const { getAuth } = resolveFrom('firebase-admin/auth');
  const { getFirestore, FieldValue, Timestamp } = resolveFrom('firebase-admin/firestore');

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });

  cached = {
    auth: getAuth(app),
    db: getFirestore(app),
    FieldValue,
    Timestamp,
    projectId: serviceAccount.project_id,
  };
  return cached;
}
