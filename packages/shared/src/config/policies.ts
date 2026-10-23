/**
 * Policies (Settings › Policies) — shared limits and the fixed ids of the two migrated policies.
 *
 * WHY fixed ids for exactly these two: they used to live on `general/config` and were served at
 * `/privacy-policy` and `/terms` (links already given to Razorpay and indexed by search engines), and the
 * app had `/profile/privacy` + `/profile/terms` routes. Keeping a known id lets every old link redirect
 * straight to the right document. Policies the admin adds later get ordinary auto ids.
 */
export const LEGACY_POLICY_IDS = {
  privacyPolicy: 'privacy-policy',
  termsAndConditions: 'terms-and-conditions',
} as const;

/** Most policies the store may hold — lists read them in one bounded query, no pagination. */
export const POLICY_LIST_LIMIT = 50;

/** Max length of a policy's name (it is a footer link / list row label). */
export const POLICY_NAME_MAX = 80;
