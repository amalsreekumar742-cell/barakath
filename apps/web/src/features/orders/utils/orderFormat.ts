import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { OrderStatus, type OrderProps, type OrderStatusTimelineEntry } from '@barakath/shared';
import { formatInr } from '@/components/catalog/PriceBlock';

/**
 * Order money/date/reference formatting — mirrors `apps/app/lib/features/orders/presentation/widgets/
 * order_format.dart` field-for-field so the same order reads identically on the app and the website.
 * Centralised here (not re-derived per component) so the order card, detail, tracking and invoice
 * screens can never quote four different numbers for the same order.
 */

/**
 * The order reference shown to the customer: `#` + the first 8 characters of the Firestore document
 * id, case preserved.
 *
 * WHY: the deployed order document has NO human `orderId`/`#BRK-XXXXX` field (packages/shared's
 * `OrderProps` — grepped before writing this — has no such field either) — the Firestore document id
 * IS the reference. This matches the admin panel's order list/detail and the Flutter app's own
 * `OrderFormat.reference`, so a customer quoting a reference finds the same string an agent sees.
 */
export function orderReference(orderId: string): string {
  if (!orderId) return '—';
  return orderId.length <= 8 ? `#${orderId}` : `#${orderId.slice(0, 8)}`;
}

/** Two-decimal money — price summaries, the invoice, anything auditable. */
export const money = formatInr;

export function formatDate(value: Date | Timestamp | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'd MMM yyyy') : '—';
}

export function formatDateShort(value: Date | Timestamp | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'EEE, d MMM') : '—';
}

export function formatDateTime(value: Date | Timestamp | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, 'd MMM, h:mm a') : '—';
}

function toDate(value: Date | Timestamp | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

/** Total quantity across every line — the card/tracking subtitle's "N items". */
export function totalItems(order: OrderProps): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * The timestamp a given status reached, read off `statusTimeline` — the deployed schema has no
 * per-status columns (`pendingAt`/`acceptedAt`/…), just this one array, so every "when did X happen"
 * question resolves through here.
 */
export function timestampFor(order: OrderProps, status: OrderStatus): Timestamp | null {
  const entry = order.statusTimeline.find((e) => normalizeStatus(e.status) === status);
  return entry?.timestamp ?? null;
}

export function noteFor(order: OrderProps, status: OrderStatus): string {
  const entry = order.statusTimeline.find((e) => normalizeStatus(e.status) === status);
  return entry?.note ?? '';
}

function normalizeStatus(value: string): OrderStatus | null {
  const v = (value ?? '').trim().toLowerCase();
  const match = (Object.values(OrderStatus) as string[]).find((s) => s.toLowerCase() === v);
  return (match as OrderStatus) ?? null;
}

/** The six-step tracking timeline, in order (spec 3.11): Pending → … → Delivered. Cancelled is a
 *  single terminal state elsewhere, never part of this list. */
export const TRACKING_STEPS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

/** Position in `TRACKING_STEPS`; -1 for Cancelled (rendered as a single terminal state instead). */
export function timelineIndex(status: OrderStatus): number {
  if (status === OrderStatus.CANCELLED) return -1;
  return TRACKING_STEPS.indexOf(status);
}

/**
 * Derived estimated-delivery date: the real `Delivered` timestamp once reached, else `createdAt` +
 * `ETA_DAYS`.
 *
 * GAP (matches the Flutter app's own documented gap): the deployed order document carries no ETA /
 * promised-date field and there is no courier API wired up. Every caller must label this "Estimated",
 * never "Arriving by" — the store is not promising a date it never committed to.
 */
const ETA_DAYS = 5;

export function estimatedDelivery(order: OrderProps): Date | null {
  const delivered = timestampFor(order, OrderStatus.DELIVERED);
  if (delivered) return delivered.toDate();
  const created = order.createdAt?.toDate();
  if (!created) return null;
  const eta = new Date(created);
  eta.setDate(eta.getDate() + ETA_DAYS);
  return eta;
}

/** What the customer saved: per-line MRP headroom plus the coupon. */
export function savings(order: OrderProps): number {
  let saved = order.couponDiscount || 0;
  for (const item of order.items) {
    const off = item.mrp - item.offerPrice;
    if (off > 0) saved += off * item.quantity;
  }
  return saved;
}

/**
 * Payment method as the customer should read it. Returns null for Cash-on-Delivery — COD is not a
 * method this store offers (the row is dropped rather than rendering a method that does not exist),
 * matching the Flutter app's own `OrderFormat.paymentMethod`.
 */
export function paymentMethodLabel(order: OrderProps): string | null {
  const value = (order.paymentMethod ?? '').trim();
  const normalised = value.toLowerCase().replace(/[^a-z]/g, '');
  if (!value || normalised === 'cod' || normalised === 'cashondelivery') return null;
  switch (value.toLowerCase()) {
    case 'both':
      return 'Wallet + Razorpay';
    case 'wallet':
      return 'Wallet';
    case 'razorpay':
      return 'Razorpay';
    default:
      return value;
  }
}

export type { OrderStatusTimelineEntry };
