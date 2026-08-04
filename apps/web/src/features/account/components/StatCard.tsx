import type { ReactNode } from 'react';

/**
 * A single labelled figure — the wallet balance, lifetime affiliate earnings, "this month", pending
 * commission, etc. (Batch 4 brief §5: shared by the wallet and affiliate dashboards so neither screen
 * invents its own tile.)
 */
export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** A smaller line under the value — e.g. "+₹180 this month" or a trailing note. */
  secondary?: ReactNode;
  className?: string;
}

/**
 * WHY `value` and `secondary` render in a `<div>` rather than a `<p>`: both are typed `ReactNode`,
 * so a caller may legitimately pass an element — the wallet screen passes `<SkeletonText/>` while its
 * breakdown loads. A `<p>` may only contain phrasing content, so any block child makes the browser
 * close the paragraph early and the resulting DOM stops matching the server HTML, which surfaces as
 * a hydration error. `label` stays a `<p>` because it is typed `string`.
 */
export function StatCard({ label, value, secondary, className = '' }: StatCardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-2 font-display text-xl font-semibold text-foreground">{value}</div>
      {secondary && <div className="mt-1 text-xs text-faint">{secondary}</div>}
    </div>
  );
}
