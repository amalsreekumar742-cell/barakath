import type { DeliveryTaxConfig, RazorpaySecrets } from './types';

/**
 * Readers for the single `general/config` document (spec §1.21 Settings). The admin Settings screen
 * groups each tab under its own map (`delivery`, `payment`, …), while the shared Razorpay scaffolding
 * (config/razorpay.ts) reads the gateway keys at the TOP LEVEL. To be robust to both layouts these
 * readers look in the grouped map first and fall back to the top level (or vice-versa), so a value set
 * in either place is honoured. WHY here (not in config/): config/ is shared scaffolding owned elsewhere;
 * these order-feature-specific reads live inside this feature's service layer.
 */

/** Coerce an unknown Firestore value to a finite number, defaulting to 0. */
function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/** Coerce an unknown Firestore value to a string, defaulting to ''. */
function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Read the delivery + tax settings (grouped under `delivery`, falling back to the top level). */
export function getDeliveryTaxConfig(config: FirebaseFirestore.DocumentData): DeliveryTaxConfig {
  const delivery = (config.delivery as Record<string, unknown> | undefined) ?? {};
  return {
    standardDeliveryFee: toNumber(delivery.standardDeliveryFee ?? config.standardDeliveryFee),
    freeDeliveryThreshold: toNumber(delivery.freeDeliveryThreshold ?? config.freeDeliveryThreshold),
    gstPercentage: toNumber(delivery.gstPercentage ?? config.gstPercentage),
  };
}

/**
 * Read the Razorpay credentials. [secrets] is the admin-only `general/secrets` document — the two secrets
 * live there because `general/config` is public-read (the customer app needs delivery/GST/support from it).
 * The `config` lookups remain as a migration fallback for installs configured before that split.
 */
export function getRazorpaySecrets(
  config: FirebaseFirestore.DocumentData,
  secrets: FirebaseFirestore.DocumentData = {},
): RazorpaySecrets {
  const payment = (config.payment as Record<string, unknown> | undefined) ?? {};
  return {
    keyId: toStr(config.razorpayKeyId ?? payment.razorpayKeyId),
    keySecret: toStr(
      secrets.razorpayKeySecret ?? config.razorpayKeySecret ?? payment.razorpayKeySecret,
    ),
    webhookSecret: toStr(
      secrets.razorpayWebhookSecret ??
        config.razorpayWebhookSecret ??
        payment.razorpayWebhookSecret,
    ),
  };
}

/** Whether wallet payments are enabled at checkout (spec §1.21 Payment Gateway tab). */
export function isWalletEnabled(config: FirebaseFirestore.DocumentData): boolean {
  const payment = (config.payment as Record<string, unknown> | undefined) ?? {};
  return Boolean(payment.walletPaymentsEnabled ?? config.walletPaymentsEnabled ?? false);
}
