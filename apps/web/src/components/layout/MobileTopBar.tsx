import type { ReactNode } from 'react';
import { CircleBackButton } from '@/components/CircleBackButton';

/**
 * The mobile top bar for a PUSHED screen — back button, title, optional trailing action.
 * Mirrors the Flutter app's pushed-page app bar (42px circle back + 20px/w800 title).
 *
 * WHY mobile-only (`lg:hidden`): above 1024px the site header and breadcrumbs already give the
 * visitor their position and a way out, and a second back affordance under them reads as clutter.
 *
 * WHY this is a Server Component: it is static chrome. Only the back button itself is a client
 * island, so a page using this bar does not become interactive for the sake of a title.
 */
export interface MobileTopBarProps {
  title: string;
  /** Destination for back. Omit to pop history — see CircleBackButton. */
  backHref?: string;
  /** Small text under the title, e.g. "3 items". */
  subtitle?: string;
  /** Trailing control, e.g. a search or share button. */
  action?: ReactNode;
  /** Set when the bar should stay put as the page scrolls. */
  sticky?: boolean;
}

export function MobileTopBar({
  title,
  backHref,
  subtitle,
  action,
  sticky = false,
}: MobileTopBarProps) {
  return (
    <div
      className={`flex items-center gap-3 bg-app px-4 pb-2.5 pt-3 lg:hidden ${
        sticky ? 'sticky top-0 z-30' : ''
      }`}
    >
      <CircleBackButton href={backHref} />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold tracking-[-0.4px] text-foreground">
          {title}
        </h1>
        {subtitle && <p className="truncate text-[13px] text-muted">{subtitle}</p>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
