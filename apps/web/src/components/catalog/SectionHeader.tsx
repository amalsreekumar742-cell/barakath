import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export interface SectionHeaderProps {
  title: string;
  /** When set, a "See all →" link is shown pinned to the right edge. */
  actionHref?: string;
  actionLabel?: string;
  /** Rendered right after the title (e.g. a flash-sale countdown chip). */
  trailing?: ReactNode;
  className?: string;
}

/**
 * The "Title …… See all →" row every home rail and section shares (design: 800 title, 700 green
 * action).
 *
 * WHY the title group is `flex-1 min-w-0` and the action is `shrink-0`: this is the web mirror of the
 * Flutter `section_header.dart` fix. The title group must eat every spare pixel so the action sits
 * hard against the right margin — the same margin as the grid beneath it — for EVERY title. If the
 * title instead shrank to its text width, "See all" would float mid-row and move depending on how
 * long the title was ("Floral" vs "Woody" put it in visibly different places). `min-w-0` + `truncate`
 * lets a long title ellipsize instead of pushing the action off the edge.
 */
export function SectionHeader({
  title,
  actionHref,
  actionLabel = 'See all',
  trailing,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h2 className="min-w-0 truncate font-display text-xl font-extrabold tracking-tight text-foreground md:text-2xl">
          {title}
        </h2>
        {trailing}
      </div>
      {actionHref && (
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition hover:text-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {actionLabel}
          <ArrowRight size={16} strokeWidth={2.25} aria-hidden />
        </Link>
      )}
    </div>
  );
}
