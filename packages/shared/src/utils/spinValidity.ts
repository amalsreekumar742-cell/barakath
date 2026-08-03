/**
 * Spin-reward validity — the single definition of how long a coupon won on the wheel stays redeemable.
 *
 * WHY this lives in shared: the admin panel writes the campaign, the website and the app both tell the
 * customer how long their reward lasts, and the `spinWheel` Cloud Function stamps the actual expiry.
 * If any two of those disagree the customer is shown a deadline that is not the one enforced at
 * checkout. The rule is written once here.
 *
 * `functions/` deliberately does not depend on this workspace package at runtime (see the header of
 * functions/src/growth/spinWheel.ts), so it re-implements `resolveValidityHours` in three lines. The
 * Flutter app re-implements it too, in SpinnerCampaign.validityHours. Change all three together.
 */

/** Spec default when a campaign specifies neither hours nor days: 3 days. */
export const DEFAULT_SPIN_VALIDITY_HOURS = 72;

/**
 * How long a coupon won from this campaign is valid, in hours.
 *
 * `couponValidityHours` wins whenever it is set, because it is the more precise field and the only one
 * that can express a sub-day window. `couponValidityDays` is the pre-existing field and remains the
 * fallback so campaigns created before hours existed keep the window they were configured with.
 */
export function resolveValidityHours(campaign: {
  couponValidityHours?: number;
  couponValidityDays?: number;
}): number {
  const hours = campaign.couponValidityHours ?? 0;
  if (hours > 0) return hours;
  const days = campaign.couponValidityDays ?? 0;
  if (days > 0) return days * 24;
  return DEFAULT_SPIN_VALIDITY_HOURS;
}

/**
 * A validity window as customer-facing copy: "1 hour", "6 hours", "3 days", "1 day 6 hours".
 *
 * WHY not always hours: "72 hours" is correct but reads worse than "3 days" for the common case, and
 * the whole point of the hours field is the short windows, where "1 hour" is exactly what to say.
 */
export function formatValidityWindow(totalHours: number): string {
  if (totalHours <= 0) return '0 hours';
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (totalHours < 24) return plural(totalHours, 'hour');

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (hours === 0) return plural(days, 'day');
  return `${plural(days, 'day')} ${plural(hours, 'hour')}`;
}

/**
 * Time LEFT on an already-minted reward, as copy: "Expires in 42 minutes", "Expires in 3 hours".
 *
 * WHY minutes appear here but not in `formatValidityWindow`: a configured window is always whole hours,
 * but a countdown against a real `validUntil` passes through the final hour, and "Expires in 0 hours"
 * is both wrong-looking and less useful than "Expires in 12 minutes".
 */
export function formatTimeRemaining(validUntilMs: number, nowMs: number): string {
  const ms = validUntilMs - nowMs;
  if (ms <= 0) return 'Expired';

  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Expires in ${minutes === 1 ? '1 minute' : `${minutes} minutes`}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Expires in ${hours === 1 ? '1 hour' : `${hours} hours`}`;

  const days = Math.floor(hours / 24);
  return `Expires in ${days === 1 ? '1 day' : `${days} days`}`;
}
