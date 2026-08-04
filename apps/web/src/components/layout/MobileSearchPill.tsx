import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { Constants } from '@/config/constants';

/**
 * The mobile search entry point — the logo mark beside a tappable search pill.
 * Mirrors `HomeSearchBar` in `apps/app/lib/features/home/presentation/widgets/home_app_bar.dart`.
 *
 * WHY it exists: the site header is desktop-only now, and it was the only place a phone visitor
 * could search. This restores that without bringing back the 116px two-row header — the app solves
 * it the same way, with a pill that is a BUTTON rather than a live input.
 *
 * WHY a link rather than an input: an input in a sticky bar summons the keyboard and steals half the
 * viewport the moment it is focused, and the suggestions dropdown then has nowhere to render. The
 * app navigates to a dedicated search screen instead, where the field owns the whole page.
 *
 * Phase 2 puts the greeting row (`ASSALAMU ALAIKUM` / `Hi {name}` + bell + avatar) above this on the
 * home screen specifically; this pill stays as the shared element beneath it.
 */
export function MobileSearchPill() {
  return (
    <div className="flex items-center gap-3 bg-app px-4 pb-2 pt-3 lg:hidden">
      {/*
        The logo mark is a tall narrow lockup, so at `h-8` its natural hit box is only ~17px wide.
        The -mx-2 px-2 pair widens the tappable area to a full 44px without moving the mark itself
        or adding gap to the row.
      */}
      <Link
        href="/"
        aria-label={`${Constants.APP_NAME} home`}
        className="-mx-2 inline-flex h-11 shrink-0 items-center px-2"
      >
        <Image
          src="/logo.png"
          alt={Constants.APP_NAME}
          width={40}
          height={76}
          priority
          className="h-8 w-auto object-contain"
        />
      </Link>

      <Link
        href="/search"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-3 text-sm text-faint transition active:bg-subtle"
      >
        <Search className="size-[19px] shrink-0" aria-hidden />
        <span className="truncate">Search perfumes, books, clothing…</span>
      </Link>
    </div>
  );
}
