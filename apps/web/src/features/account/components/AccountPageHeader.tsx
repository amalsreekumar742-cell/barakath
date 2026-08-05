import type { ReactNode } from 'react';
import { CircleBackButton } from '@/components/CircleBackButton';

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
  /**
   * Renders the mobile back button beside the title.
   *
   * Defaults to FALSE — unlike `Breadcrumb`, which defaults it on — because most account pages already
   * render a `Breadcrumb` above this header and would otherwise show two back buttons. Set it only on
   * the account screens that have no breadcrumb of their own (notifications, settings).
   */
  showBack?: boolean;
}

export function AccountPageHeader({
  title,
  subtitle,
  action,
  showBack = false,
}: AccountPageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {showBack && <CircleBackButton className="lg:hidden" />}
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
