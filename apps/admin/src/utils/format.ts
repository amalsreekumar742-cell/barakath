import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

/**
 * Formatting helpers shared across admin screens (₹ INR, Indian locale; dates).
 * WHY centralize: currency + date rendering must be identical everywhere (spec: ₹ INR). Keeping the
 * `Intl`/date-fns config in one place avoids each screen re-implementing (and drifting on) the format.
 */

const inr0 = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Full rupee amount with Indian digit grouping, no paise — e.g. 147200 → "₹1,47,200". */
export function formatINR(value: number): string {
  return inr0.format(Number.isFinite(value) ? value : 0);
}

/**
 * Compact rupee amount using Indian units (K / L / Cr) for large figures — e.g. 184000 → "₹1.84L".
 * WHY: dashboard KPI cards show headline revenue compactly (design: "₹1.84L"); small values stay full.
 */
export function formatINRCompact(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.00$/, '')}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.00$/, '')}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return formatINR(v);
}

/** Long date for the dashboard header — e.g. "Tuesday, 15 July 2026". */
export function formatLongDate(date: Date): string {
  return format(date, 'EEEE, d MMMM yyyy');
}

/** Short date for tables — e.g. "15 Jul 2026". Accepts a Firestore Timestamp or Date. */
export function formatShortDate(value: Timestamp | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : value.toDate();
  return format(d, 'd MMM yyyy');
}

/** A signed percentage label for trend indicators — e.g. 12.4 → "12.4%". */
export function formatPercent(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  return `${Math.abs(v).toFixed(1)}%`;
}
