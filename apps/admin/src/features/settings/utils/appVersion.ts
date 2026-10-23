/**
 * Version helpers for Settings › App Update. They mirror `AppUpdatePolicy.compareVersions` in the
 * Flutter app (apps/app/lib/features/settings/domain/entities/app_update_policy.dart), so a version
 * the admin saves compares the same way on the device. Keep the two in step.
 */

/** `major[.minor[.patch]]`, digits only — the store version NAME, never the build number. */
const VERSION_SHAPE = /^\d+(\.\d+){0,2}$/;

export const isValidVersion = (v: string): boolean => VERSION_SHAPE.test(v.trim());

/** Numeric compare of `major.minor.patch`; missing segments count as 0, so "1.2" equals "1.2.0". */
export function compareVersions(a: string, b: string): number {
  const pa = a.trim().split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.trim().split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
