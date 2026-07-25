import Razorpay from 'razorpay';
import { getFirestore } from 'firebase-admin/firestore';
import { Collections } from './collections';

/**
 * Razorpay gateway config (spec §1.19 Settings → Payment Gateway). The admin panel writes the keys to
 * the `general/config` document, so functions read them from there rather than from a build-time param —
 * a single runtime source of truth shared with the admin settings screen.
 *
 * SECRET SPLIT: `general/config` is PUBLIC-READ — the customer app needs the delivery fees, GST, support
 * contacts and app version from it, and it cannot read a doc that also holds a gateway secret. So the two
 * secrets live in their own admin-only `general/secrets` document. `razorpayKeyId` deliberately stays in
 * the public doc: it is the *publishable* key the client checkout SDK needs.
 *
 * NOTE (security): storing secrets in Firestore at all is this project's existing design. For production
 * hardening, migrate them to Secret Manager via `defineSecret`. Until then, Security Rules must keep
 * `general/secrets` admin-only.
 */
/** The admin-only sibling of `general/config` that holds gateway secrets. */
export const SECRETS_DOC = 'secrets';

export interface GatewayConfig {
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
}

/** Read the raw general/config document (throws if missing) — shared by the instance + webhook verifiers. */
export async function getGeneralConfig(): Promise<FirebaseFirestore.DocumentData> {
  const db = getFirestore();
  const snap = await db.collection(Collections.general).doc('config').get();
  if (!snap.exists) throw new Error('general/config document is missing');
  return snap.data() as FirebaseFirestore.DocumentData;
}

/** Read the admin-only `general/secrets` document. Absent = gateway not configured yet, not an error. */
export async function getSecretsDoc(): Promise<Record<string, unknown>> {
  const db = getFirestore();
  const snap = await db.collection(Collections.general).doc(SECRETS_DOC).get();
  return snap.exists ? (snap.data() as Record<string, unknown>) : {};
}

/**
 * Read the gateway keys. The publishable key id comes from the public `general/config` (`payment` map,
 * with a top-level fallback); the two secrets come from the admin-only `general/secrets`.
 *
 * WHY the config fallback for secrets: installations configured before the split still have them under
 * `general/config.payment`, and silently returning an empty secret would surface as an opaque Razorpay
 * auth failure. Remove the fallback once every environment has been migrated.
 */
export async function getGatewaySecrets(): Promise<GatewayConfig> {
  const [config, secrets] = await Promise.all([getGeneralConfig(), getSecretsDoc()]);
  const payment = (config.payment ?? {}) as Record<string, unknown>;
  return {
    razorpayKeyId: (payment.razorpayKeyId ?? config.razorpayKeyId ?? '') as string,
    razorpayKeySecret: (secrets.razorpayKeySecret ??
      payment.razorpayKeySecret ??
      config.razorpayKeySecret ??
      '') as string,
    razorpayWebhookSecret: (secrets.razorpayWebhookSecret ??
      payment.razorpayWebhookSecret ??
      config.razorpayWebhookSecret ??
      '') as string,
  };
}

/** Build a Razorpay SDK instance from the keys stored in general/config. */
export async function getRazorpayInstance(): Promise<Razorpay> {
  const { razorpayKeyId, razorpayKeySecret } = await getGatewaySecrets();
  return new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
}
