import type { Timestamp } from 'firebase/firestore';

/**
 * General settings — the single `general/config` document backing the admin Settings screen (spec §1.21).
 *
 * WHY one doc (not a collection): every tab reads/writes the SAME config document; each tab saves only
 * its own slice of fields independently (spec §1.21 "All tabs save independently"). Each tab's fields
 * are grouped under their own map (`variables`, `delivery`, `payment`, `privacy`, `terms`, `contactus`)
 * so the document stays organized and a tab save is a deep-merge of just that one map. Shared across
 * admin (write), storefront (read) and Cloud Functions (checkout math).
 *
 * WHY Timestamp for date fields: the "Last updated" stamps on the legal tabs are server-authoritative.
 */

/** Tab 1 — a direct colour unit: display name + hex code (shown as a removable swatch chip). */
export interface ColorUnit {
  name: string;
  code: string;
}

/** Tab 1 — a variant group (e.g. Size, Material) with its units as removable chips. */
export interface VariantGroup {
  name: string;
  units: string[];
}

/** Tab 1 — Variables map. */
export interface VariablesSettings {
  /** Direct colour units (name + hex), used by the product form's colour picker. */
  colors: ColorUnit[];
  /** Named variant groups (Size, Material, …), each with its own list of unit values. */
  variantGroups: VariantGroup[];
}

/** Tab 2 — Delivery & Tax map. */
export interface DeliverySettings {
  /** Standard delivery fee (₹). */
  standardDeliveryFee: number;
  /** Minimum order value (₹) that qualifies for free delivery. */
  freeDeliveryThreshold: number;
  /** GST rate (%). */
  gstPercentage: number;
  /** GST identification number. */
  gstin: string;
  /** When true, displayed prices already include tax. */
  pricesIncludeTax: boolean;
}

/** Tab 3 — Payment Gateway map. */
export interface PaymentSettings {
  /** Razorpay Key ID (sensitive — masked in the UI). */
  razorpayKeyId: string;
  /** Razorpay Key secret (sensitive — masked in the UI). */
  razorpayKeySecret: string;
  /** Connection status the admin sets manually (Connected / Disconnected). */
  razorpayConnected: boolean;
  /** Wallet payments toggle — OFF shows the option greyed/disabled at checkout. */
  walletPaymentsEnabled: boolean;
}

/** Tab 4 — Privacy Policy map. */
export interface PrivacySettings {
  /** Rich-text (HTML) privacy policy authored in React Quill. */
  privacyPolicy: string;
  /** Auto-set on save — powers the "Last updated" line. */
  privacyPolicyUpdatedAt: Timestamp | null;
}

/** Tab 5 — Terms & Conditions map. */
export interface TermsSettings {
  /** Rich-text (HTML) terms & conditions authored in React Quill. */
  termsAndConditions: string;
  /** Auto-set on save — powers the "Last updated" line. */
  termsUpdatedAt: Timestamp | null;
}

/** Tab 6 — Help & Support (contact us) map. */
export interface ContactUsSettings {
  helpPhone: string;
  helpWhatsApp: string;
  helpEmail: string;
}

export interface GeneralSettingsProps {
  /** Tab 1 — Variables (spec §1.21 Tab 1). */
  variables: VariablesSettings;
  /** Tab 2 — Delivery & Tax (spec §1.21 Tab 2). */
  delivery: DeliverySettings;
  /** Tab 3 — Payment Gateway (spec §1.21 Tab 3). */
  payment: PaymentSettings;
  /** Tab 4 — Privacy Policy (spec §1.21 Tab 4). */
  privacy: PrivacySettings;
  /** Tab 5 — Terms & Conditions (spec §1.21 Tab 5). */
  terms: TermsSettings;
  /** Tab 6 — Help & Support (spec §1.21 Tab 6). */
  contactus: ContactUsSettings;
  /** Last write to any part of the document. */
  updatedAt: Timestamp | null;
}
