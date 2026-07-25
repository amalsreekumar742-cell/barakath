'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Timestamp } from 'firebase/firestore';

/**
 * FlashCountdown — the ticking HH:MM:SS timer beside a live flash sale (spec §1.16).
 *
 * WHY it recomputes the remaining time from `Date.now()` on every tick instead of decrementing a
 * counter: a backgrounded/suspended tab (laptop asleep, phone locked) freezes `setInterval`, so a
 * decrementing counter drifts behind real time by exactly the suspended duration and would keep
 * showing a sale that has already ended. Reading the wall clock each tick is immune — on resume it
 * jumps straight to the true remaining time (or fires the expiry).
 *
 * WHY at zero it calls `onExpire ?? router.refresh()`: when the window closes the scheduler has (within
 * 5 minutes) cleared `isFlashSale`/`flashSalePrice`, so the page's flash prices are stale. `router.refresh()`
 * re-runs the Server Component with fresh data; a caller that wants different behaviour (e.g. hide a rail)
 * passes `onExpire`.
 */
export interface FlashCountdownProps {
  /**
   * When the sale ends. Prefer passing epoch millis (`number`) — a Firestore `Timestamp` handed from a
   * Server Component to this Client Component is serialized to a plain `{ seconds, nanoseconds }` object
   * and loses its `.toMillis()` method, which this component handles defensively but callers should avoid.
   */
  endDate: Timestamp | number;
  /** Runs once when the countdown reaches zero. Defaults to `router.refresh()`. */
  onExpire?: () => void;
  /** Extra classes for the outer element; positioning/size is the caller's job. */
  className?: string;
}

/**
 * Normalise the many shapes `endDate` can arrive in to epoch millis.
 * WHY defensive: a live `Timestamp` has `.toMillis()`, but the same value serialized across the RSC
 * boundary is a plain `{ seconds, nanoseconds }` with no methods — both must resolve to the same instant.
 */
function resolveEndMs(endDate: Timestamp | number): number {
  if (typeof endDate === 'number') return endDate;
  if (typeof endDate.toMillis === 'function') return endDate.toMillis();
  const plain = endDate as unknown as { seconds?: number; nanoseconds?: number };
  return (plain.seconds ?? 0) * 1000 + Math.floor((plain.nanoseconds ?? 0) / 1e6);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function FlashCountdown({ endDate, onExpire, className = '' }: FlashCountdownProps) {
  const router = useRouter();
  const endMs = resolveEndMs(endDate);

  // WHY `null` until mounted: the server-rendered HTML and the first client render must match, and
  // `Date.now()` differs between them. Rendering nothing until the effect sets a value sidesteps any
  // hydration mismatch; the timer pops in a tick after load, which is imperceptible for a promo widget.
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // Keep the latest onExpire without making it an effect dependency (an inline handler changes identity
  // each render and would otherwise tear down/rebuild the interval every second).
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (endMs - Date.now() <= 0) {
      setRemainingMs(0);
      return;
    }
    let fired = false;
    const tick = () => {
      const left = Math.max(0, endMs - Date.now());
      setRemainingMs(left);
      if (left <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        if (onExpireRef.current) onExpireRef.current();
        else router.refresh();
      }
    };
    const id = setInterval(tick, 1000);
    tick(); // paint the correct value immediately rather than after the first 1s gap
    return () => clearInterval(id);
  }, [endMs, router]);

  // Not yet mounted, or already past: render nothing (spec — "renders nothing if endDate is past").
  if (remainingMs === null || remainingMs <= 0) return null;

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <span
      // WHY `bg-error` (red) and not `bg-ink`: the design's flash-sale countdown is a red pill — red
      // signals urgency/limited-time the way the rest of the neutral palette deliberately doesn't.
      className={`inline-flex items-center gap-1 rounded-full bg-error px-2.5 py-1 font-display text-xs font-extrabold tabular-nums text-white ${className}`}
      role="timer"
      aria-label={`Flash sale ends in ${pad(hours)} hours ${pad(minutes)} minutes ${pad(seconds)} seconds`}
    >
      {pad(hours)}<span aria-hidden>:</span>{pad(minutes)}<span aria-hidden>:</span>{pad(seconds)}
    </span>
  );
}
