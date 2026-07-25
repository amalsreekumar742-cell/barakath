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

export function StatCard({ label, value, secondary, className = '' }: StatCardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-2 font-display text-xl font-extrabold text-foreground">{value}</p>
      {secondary && <p className="mt-1 text-xs text-faint">{secondary}</p>}
    </div>
  );
}
