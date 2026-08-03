'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { ORDER_PAYMENT_TIMEOUT_MINUTES, msUntilOrderExpiry } from '@barakath/shared/config/orderTimeout';

/**
 * OrderExpiryCountdown — how long an unpaid order has left before it is auto-cancelled and its items
 * are released back to stock.
 *
 * WHY the customer is told at all: checkout reserves stock BEFORE payment, so an unpaid order is
 * holding inventory. `expireUnpaidOrders` reclaims it after ORDER_PAYMENT_TIMEOUT_MINUTES. A customer
 * who wanders off and comes back to find their order gone deserves to have seen the deadline.
 *
 * WHY it recomputes from `Date.now()` every tick rather than decrementing a counter: a backgrounded
 * tab throttles timers, so a decrementing counter drifts and would show time the customer does not
 * actually have. Same approach as `FlashCountdown`.
 *
 * WHY it keeps rendering at zero instead of unmounting: "expired" is the state the customer most needs
 * explained — silently vanishing would be worse than the countdown never appearing.
 */
export function OrderExpiryCountdown({
  createdAtMs,
  onExpire,
  className = '',
}: {
  /** The order's `createdAt` in epoch millis — NOT "now", so a reload never restarts the clock. */
  createdAtMs: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [remainingMs, setRemainingMs] = useState(() => msUntilOrderExpiry(createdAtMs, Date.now()));

  useEffect(() => {
    setRemainingMs(msUntilOrderExpiry(createdAtMs, Date.now()));
    const id = setInterval(() => {
      setRemainingMs(msUntilOrderExpiry(createdAtMs, Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [createdAtMs]);

  const expired = remainingMs <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  if (expired) {
    return (
      <p className={`text-sm text-faint ${className}`} role="status">
        This order has been released and its items returned to stock. Place a new order to try again.
      </p>
    );
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

  return (
    <p
      className={`inline-flex items-center gap-2 rounded-lg border border-warning-subtle bg-warning-subtle/50 px-3 py-2 text-sm text-foreground ${className}`}
      role="timer"
      aria-live="off"
    >
      <Clock className="size-4 shrink-0 text-warning" aria-hidden />
      <span>
        Complete payment within{' '}
        <span className="font-semibold tabular-nums">
          {mm}:{ss}
        </span>{' '}
        or this order is cancelled and your items released.
      </span>
    </p>
  );
}

/** The window length, for copy that needs to state it up front (e.g. "you have 10 minutes"). */
export { ORDER_PAYMENT_TIMEOUT_MINUTES };
