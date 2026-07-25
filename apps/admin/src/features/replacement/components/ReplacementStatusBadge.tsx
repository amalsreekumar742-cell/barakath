import type { FC } from 'react';
import { ReplacementStatus } from '@barakath/shared/config/enums';

/**
 * ReplacementStatusBadge — the standard status pill for replacement requests (spec §1.10; design:
 * subtle-tinted bg + strong fg, radius 6, 700/11px). One component so the list and the detail page
 * render request status identically. Pending=amber, Approved=green, Rejected=red — mapped to the
 * semantic status tokens.
 */
const TONES: Record<string, string> = {
  [ReplacementStatus.PENDING]: 'bg-warning-subtle text-warning',
  [ReplacementStatus.APPROVED]: 'bg-success-subtle text-success',
  [ReplacementStatus.REJECTED]: 'bg-error-subtle text-error',
};

const ReplacementStatusBadge: FC<{ status: string; large?: boolean }> = ({ status, large }) => {
  const tone = TONES[status] ?? 'bg-subtle text-muted';
  return (
    <span
      className={`inline-flex items-center rounded-sm font-bold ${tone} ${
        large ? 'px-2.5 py-1 text-[13px]' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      {status}
    </span>
  );
};

export default ReplacementStatusBadge;
