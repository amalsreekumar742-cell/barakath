/**
 * cloudFunctionUrls — deployed Cloud Function endpoint URLs (one entry per function).
 * WHY here: a feature's `api/` fetch wrapper references `cloudFunctionUrls.xxx`, never an inline URL.
 * Placeholder — populated as functions are deployed.
 */
export const cloudFunctionUrls = {
  // e.g. createOrder: 'https://createorder-xxxx-uc.a.run.app',
} as const;
