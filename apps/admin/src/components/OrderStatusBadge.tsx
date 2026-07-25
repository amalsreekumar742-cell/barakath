import type { FC } from 'react';
import { OrderStatus } from '@barakath/shared/config/enums';

/**
 * OrderStatusBadge — the standard status pill for orders (spec §1.3, §1.7; design: subtle-tinted bg +
 * strong fg, radius 6, 700/11px). One component so every screen renders order status identically.
 *
 * WHY a lookup map: each status has a fixed tone (Pending=amber, Accepted=blue, Packed=purple,
 * Shipped=indigo, Out-for-delivery=blue, Delivered=green, Cancelled=red). Purple/indigo aren't brand
 * tokens, so they use Tailwind's default palette; the rest use the semantic status tokens.
 */
const TONES: Record<string, string> = {
  [OrderStatus.PENDING]: 'bg-warning-subtle text-warning',
  [OrderStatus.ACCEPTED]: 'bg-info-subtle text-info',
  [OrderStatus.PACKED]: 'bg-purple-50 text-purple-700',
  [OrderStatus.SHIPPED]: 'bg-indigo-50 text-indigo-700',
  [OrderStatus.OUT_FOR_DELIVERY]: 'bg-info-subtle text-info',
  [OrderStatus.DELIVERED]: 'bg-success-subtle text-success',
  [OrderStatus.CANCELLED]: 'bg-error-subtle text-error',
};

const OrderStatusBadge: FC<{ status: string }> = ({ status }) => {
  const tone = TONES[status] ?? 'bg-subtle text-muted';
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {status}
    </span>
  );
};

export default OrderStatusBadge;
