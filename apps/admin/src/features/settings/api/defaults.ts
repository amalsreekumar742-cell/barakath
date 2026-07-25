import type { GeneralSettingsProps } from '@barakath/shared/types';

/**
 * The `general/config` document id and the default settings used before the doc exists (first run) or
 * as the slice's initial shape. WHY a single doc id constant: fetch + every tab's update thunk resolve
 * the SAME document (spec §1.21 — all tabs write one config doc), so the id is defined once.
 */
export const GENERAL_DOC_ID = 'config';

/**
 * The `general/secrets` document id — the ONLY place gateway secrets may be stored. Split out from
 * `general/config` because that doc is world-readable (the storefront needs delivery/GST/support/version
 * from it before sign-in), so anything sensitive kept there would be public. Admin-only in the rules.
 */
export const SECRETS_DOC_ID = 'secrets';

/**
 * The `variables/config` document id. The Variables tab's colours + variant groups live in their OWN
 * top-level collection (spec §1.21) — separate from the `general/config` settings doc — so the product
 * catalogue's master variant data is isolated from store config. See FirestoreCollections.variables for
 * why the collection is named `variables` and not `variants`.
 */
export const VARIABLES_DOC_ID = 'config';

/** Empty-but-valid settings so the form renders controlled inputs before the first save. */
export const DEFAULT_SETTINGS: GeneralSettingsProps = {
  variables: {
    colors: [],
    variantGroups: [],
  },
  delivery: {
    standardDeliveryFee: 0,
    freeDeliveryThreshold: 0,
    gstPercentage: 0,
    gstin: '',
    pricesIncludeTax: false,
  },
  payment: {
    razorpayKeyId: '',
    razorpayKeySecret: '',
    razorpayConnected: false,
    walletPaymentsEnabled: false,
  },
  privacy: {
    privacyPolicy: '',
    privacyPolicyUpdatedAt: null,
  },
  terms: {
    termsAndConditions: '',
    termsUpdatedAt: null,
  },
  contactus: {
    helpPhone: '',
    helpWhatsApp: '',
    helpEmail: '',
  },
  updatedAt: null,
};

/**
 * Merge a stored (possibly partial) config document over the defaults, filling missing maps AND missing
 * inner fields. WHY per-map spread: the doc groups each tab under its own map, so a shallow top-level
 * spread would drop inner defaults when a map exists but is partially written — this fills both levels.
 */
export function mergeSettings(data: Partial<GeneralSettingsProps>): GeneralSettingsProps {
  return {
    variables: { ...DEFAULT_SETTINGS.variables, ...(data.variables ?? {}) },
    delivery: { ...DEFAULT_SETTINGS.delivery, ...(data.delivery ?? {}) },
    payment: { ...DEFAULT_SETTINGS.payment, ...(data.payment ?? {}) },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...(data.privacy ?? {}) },
    terms: { ...DEFAULT_SETTINGS.terms, ...(data.terms ?? {}) },
    contactus: { ...DEFAULT_SETTINGS.contactus, ...(data.contactus ?? {}) },
    updatedAt: data.updatedAt ?? null,
  };
}
