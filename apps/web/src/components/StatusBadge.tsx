/**
 * The pill that states where something stands — an order, a replacement, a withdrawal, a coupon.
 *
 * WHY one component across four features: the same word must never be green on the orders page and
 * grey on the affiliate page. This owns the mapping so no feature invents its own.
 *
 * WHY these particular colour choices, which are NOT the obvious ones:
 *   • CANCELLED is neutral grey, not red. A customer cancelling their own order is a normal
 *     outcome; red made every cancelled row read as though something had gone wrong. `Rejected` and
 *     `Failed` stay red, because those genuinely are failures.
 *   • SHIPPED / OUT FOR DELIVERY are blue, distinct from the amber of Pending — "we have it" and
 *     "it is on its way" should not wear the same colour.
 * Both were corrected in the Flutter app against the design; the website matches so a customer
 * sees the same colour for the same word in both places.
 *
 * WHY the label renders AS STORED rather than upper-cased: every status pill in the design board is
 * sentence case ("Out for delivery", not "OUT FOR DELIVERY"), and the Firestore values already
 * arrive capitalised.
 *
 * WHY an unknown status falls back to `pending` rather than throwing: a status added by a newer
 * admin build must still render. A crashed order list is worse than an amber pill.
 */
type Tone = 'positive' | 'pending' | 'info' | 'negative' | 'muted';

const TONE_CLASS: Record<Tone, string> = {
  positive: 'bg-success-subtle text-success',
  pending: 'bg-gold-subtle text-gold-strong',
  info: 'bg-info-subtle text-info',
  negative: 'bg-error-subtle text-error',
  muted: 'bg-subtle text-muted',
};

export function toneForStatus(status: string): Tone {
  switch (status.trim().toLowerCase()) {
    case 'delivered':
    case 'confirmed':
    case 'approved':
    case 'paid':
    case 'published':
    case 'cleared':
      return 'positive';
    case 'shipped':
    case 'out for delivery':
      return 'info';
    case 'rejected':
    case 'failed':
      return 'negative';
    case 'cancelled':
    case 'canceled':
    case 'used':
    case 'expired':
    case 'withdrawn':
      return 'muted';
    default:
      return 'pending';
  }
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
        TONE_CLASS[toneForStatus(status)]
      } ${className}`}
    >
      {status}
    </span>
  );
}
