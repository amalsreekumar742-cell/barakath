import { Check } from 'lucide-react';
import { OrderStatus, type OrderProps } from '@barakath/shared';
import { TRACKING_STEPS, formatDateTime, noteFor, timelineIndex, timestampFor } from '../utils/orderFormat';

const STEP_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pending',
  [OrderStatus.ACCEPTED]: 'Accepted',
  [OrderStatus.PACKED]: 'Packed',
  [OrderStatus.SHIPPED]: 'Shipped',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
};

/**
 * The SIX fixed tracking steps (spec 3.11): Pending → Accepted → Packed → Shipped → Out for delivery →
 * Delivered. Each completed step's timestamp comes from `order.statusTimeline` — the deployed schema
 * has no per-status columns, just this one array (verified against `packages/shared`'s `OrderProps` and
 * the admin panel's own order-status handling), so every step's "when" resolves through it. A future
 * step (not yet reached) renders hollow/greyed with no timestamp. Deliberately excludes rider distance,
 * unlike the app — spec 3.11 explicitly drops it for the website.
 */
export function StatusTimeline({ order }: { order: OrderProps }) {
  const currentIndex = timelineIndex(order.status);

  return (
    <div>
      {TRACKING_STEPS.map((step, i) => {
        const isDone = i <= currentIndex;
        const isLast = i === TRACKING_STEPS.length - 1;
        const at = timestampFor(order, step);
        const note = noteFor(order, step);

        return (
          <div key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  isDone ? 'border-primary bg-primary' : 'border-border-strong bg-surface'
                }`}
              >
                {isDone && <Check className="size-3 text-white" aria-hidden />}
              </span>
              {!isLast && <span className={`w-0.5 flex-1 ${isDone ? 'bg-primary' : 'bg-border-strong'}`} />}
            </div>
            <div className={isLast ? 'min-w-0 pb-0' : 'min-w-0 pb-5'}>
              <p className={`text-sm ${isDone ? 'font-extrabold text-foreground' : 'font-bold text-muted'}`}>
                {STEP_LABEL[step]}
              </p>
              <p className="mt-0.5 text-xs text-muted">{at ? formatDateTime(at) : isDone ? 'Done' : 'Pending'}</p>
              {note && <p className="mt-0.5 text-xs text-faint">{note}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
