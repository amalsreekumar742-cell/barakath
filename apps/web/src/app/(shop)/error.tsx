'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Constants } from '@/config/constants';

/**
 * The home route's error boundary (Next.js `error.tsx`) — no route-level boundary existed above this
 * segment (checked: neither `src/app/error.tsx` nor `src/app/(shop)/error.tsx` existed before this).
 * A Client Component by Next's contract (error boundaries can't be Server Components).
 *
 * WHY this is worth having even though every section already degrades individually via
 * `safeSection`: this only fires for something `safeSection` can't absorb — a throw in the Server
 * Component's own render (not inside one of the awaited section fetches), e.g. `HomePage` itself
 * throwing. `reset()` re-invokes the segment, which is the correct retry for a transient failure.
 */
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[home] failed to render:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-strong">
        {Constants.APP_NAME}
      </p>
      <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted">
        We couldn&apos;t load the home page. Please try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RotateCcw size={16} strokeWidth={2.25} aria-hidden />
        Try again
      </button>
    </main>
  );
}
