import type { ReactNode } from 'react';

/**
 * The mobile header for a TAB ROOT — a big title with no back button.
 * Mirrors the Flutter app's tab pages (Bag, Wallet, Categories: 24px/w800, ls -0.48).
 *
 * WHY no back button, unlike MobileTopBar: a tab root is a destination, not a step. The bottom nav
 * is how you leave it, and a back arrow on a tab implies a stack that is not there.
 */
export interface MobileTabHeaderProps {
  title: string;
  /** Secondary line, e.g. "3 items" — sits on the title's baseline like the app's bag header. */
  meta?: string;
  /** Trailing control, e.g. the Categories screen's circular search button. */
  action?: ReactNode;
}

export function MobileTabHeader({ title, meta, action }: MobileTabHeaderProps) {
  return (
    <div className="flex items-end gap-3 px-4 pb-3 pt-4 lg:hidden">
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="truncate text-2xl font-extrabold tracking-[-0.48px] text-foreground">
          {title}
        </h1>
        {meta && <span className="shrink-0 text-[13px] text-faint">{meta}</span>}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
