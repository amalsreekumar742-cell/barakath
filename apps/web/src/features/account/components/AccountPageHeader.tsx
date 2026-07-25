import type { ReactNode } from 'react';

/**
 * The header every /account/* page opens with — a title, an optional subtitle, and an optional
 * right-aligned action (e.g. addresses' "Add New Address" button). Batch 4 brief §5: pulled out of
 * the addresses page (which built its own inline version before this shell existed) so every other
 * account screen matches it exactly instead of re-deriving the same markup.
 */
export interface AccountPageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function AccountPageHeader({ title, subtitle, action }: AccountPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-xl font-extrabold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
