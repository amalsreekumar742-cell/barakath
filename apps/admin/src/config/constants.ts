/**
 * Constants — admin app identity, config values, thresholds, storage keys.
 * WHY grouped as one `as const` object: referenced as `Constants.xxx` everywhere; `as const` keeps
 *   literal types so keys/values are exact. Never inline these literals inside features.
 */
export const Constants = {
  APP_NAME: 'Barakath Admin',
  PAGE_SIZE: 12, // default cursor page size for paginated lists
  DEFAULT_COUNTRY_CODE: '+91',
  WEB_VERSION: '1.0.0', // bump each deploy; drives the version-update notifier
} as const;
