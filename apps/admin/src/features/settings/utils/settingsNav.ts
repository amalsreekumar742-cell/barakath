/**
 * Settings tab indices + the Policies routes, defined once.
 *
 * WHY named indices (not bare 0–4 literals): `activeTab` is a number in Redux, and the tab bar, the body
 * switch and the policy editor's "back to Policies" all have to agree on it. When Privacy Policy and
 * Terms & Conditions collapsed into one Policies tab every index after it shifted — naming them keeps
 * the next reshuffle a one-line change instead of a hunt for magic numbers.
 */
export const SettingsTab = {
  VARIABLES: 0,
  DELIVERY_TAX: 1,
  PAYMENT_GATEWAY: 2,
  OTP: 3,
  POLICIES: 4,
  HELP_SUPPORT: 5,
} as const;
export type SettingsTab = (typeof SettingsTab)[keyof typeof SettingsTab];

/** Tab-bar labels, in index order. */
export const SETTINGS_TAB_LABELS: readonly string[] = [
  'Variables',
  'Delivery & Tax',
  'Payment Gateway',
  'OTP (MSG91)',
  'Policies',
  'Help & Support',
];

export const SETTINGS_PATH = '/settings';
export const NEW_POLICY_PATH = '/settings/policies/new';

/** The editor route for one policy (the router declares it as `settings/policies/:policyId`). */
export const policyEditPath = (policyId: string): string =>
  `/settings/policies/${encodeURIComponent(policyId)}`;
