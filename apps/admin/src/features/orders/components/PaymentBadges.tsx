import type { FC } from 'react';
import { PaymentMethod, PaymentStatus } from '@barakath/shared/config/enums';

/**
 * Payment badges (spec §1.7 table). Method: Razorpay=blue, Wallet=green, Both=purple. Status:
 * Pending=amber, Paid=green, Failed=red, Refunded=gray. One place so every screen renders them alike.
 */
const METHOD_TONES: Record<string, string> = {
  [PaymentMethod.RAZORPAY]: 'bg-info-subtle text-info',
  [PaymentMethod.WALLET]: 'bg-success-subtle text-success',
  [PaymentMethod.BOTH]: 'bg-purple-50 text-purple-700',
};

const STATUS_TONES: Record<string, string> = {
  [PaymentStatus.PENDING]: 'bg-warning-subtle text-warning',
  [PaymentStatus.PAID]: 'bg-success-subtle text-success',
  [PaymentStatus.FAILED]: 'bg-error-subtle text-error',
  [PaymentStatus.REFUNDED]: 'bg-subtle text-muted',
};

const base = 'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold';

export const PaymentMethodBadge: FC<{ method: string }> = ({ method }) => (
  <span className={`${base} ${METHOD_TONES[method] ?? 'bg-subtle text-muted'}`}>{method}</span>
);

export const PaymentStatusBadge: FC<{ status: string }> = ({ status }) => (
  <span className={`${base} ${STATUS_TONES[status] ?? 'bg-subtle text-muted'}`}>{status}</span>
);
