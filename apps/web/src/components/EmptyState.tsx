import type { ReactNode } from 'react';

/**
 * The empty state — a message and nothing else.
 *
 * WHY there is no action button, and no prop to add one: spec 3.25 says empty states are message
 * only. That reads like a limitation but is deliberate — "Your wishlist is empty [Browse products]"
 * puts a second, competing call to action on a page that already has a header full of them, and
 * every screen ends up inventing its own wording for the same button. Leaving it out is what keeps
 * eleven empty screens consistent.
 *
 * WHY `icon` is a ReactNode rather than an icon name: the caller already imports its lucide icon for
 * the page it sits on; a name-to-component map here would be a second place to keep in step.
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
      {icon && <div className="mb-4 text-faint">{icon}</div>}
      <p className="font-display text-base font-semibold text-foreground">{title}</p>
      {subtitle && <p className="mt-1.5 max-w-sm text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
