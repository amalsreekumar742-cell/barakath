import type { FC } from 'react';
import { PaymentMethod, PaymentStatus } from '@barakath/shared/config/enums';

/**
 * Payment badges for the Payments screens (spec §1.9). Method: Razorpay=blue, Wallet=green, Both=purple.
 * Status: Paid=green, Pending=amber, Failed=red, Refunded=gray. Local to this feature (features don't
 * import each other) so the Payments screens render them consistently.
 */
const METHOD_TONES: Record<string, string> = {
  [PaymentMethod.RAZORPAY]: 'bg-info-subtle text-info',
  [PaymentMethod.WALLET]: 'bg-success-subtle text-success',
  [PaymentMethod.BOTH]: 'bg-purple-50 text-purple-700',
};

const STATUS_TONES: Record<string, string> = {
  [PaymentStatus.PAID]: 'bg-success-subtle text-success',
  [PaymentStatus.PENDING]: 'bg-warning-subtle text-warning',
  [PaymentStatus.FAILED]: 'bg-error-subtle text-error',
  [PaymentStatus.REFUNDED]: 'bg-subtle text-muted',
};

const base = 'inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-bold';

export const PaymentMethodBadge: FC<{ method: string }> = ({ method }) => (
  <span className={`${base} ${METHOD_TONES[method] ?? 'bg-subtle text-muted'}`}>{method}</span>
);

export const PaymentStatusBadge: FC<{ status: string; large?: boolean }> = ({ status, large }) => (
  <span
    className={`${large ? 'inline-flex items-center rounded-md px-3 py-1 text-[13px] font-bold' : base} ${
      STATUS_TONES[status] ?? 'bg-subtle text-muted'
    }`}
  >
    {status}
  </span>
);
