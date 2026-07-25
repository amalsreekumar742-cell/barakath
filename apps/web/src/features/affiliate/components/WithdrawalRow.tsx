import { Landmark } from 'lucide-react';
import { format } from 'date-fns';
import type { AffiliateWithdrawalProps } from '@barakath/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { formatInr } from '@/components/catalog/PriceBlock';
import { maskAccountNumber } from '../utils/affiliateFormat';

/**
 * One filed payout request (`affiliateWithdrawals`) — mirrors `withdrawal_tile.dart`. The account
 * number is ALWAYS masked; when admin rejects a request the reason is shown so the affiliate knows what
 * to fix (the deployed field is `rejectionReason` — WEB_BATCH4_NOTES.md §9).
 */
export function WithdrawalRow({ withdrawal }: { withdrawal: AffiliateWithdrawalProps }) {
  const isRejected = withdrawal.status === 'Rejected';
  const masked = maskAccountNumber(withdrawal.accountNumber);
  const title = withdrawal.bankName.trim() ? `${withdrawal.bankName} ${masked}` : `Withdrawal ${masked}`;

  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
          <Landmark size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-xs text-faint">
            Requested {format(withdrawal.createdAt.toDate(), 'd MMM yyyy')}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={withdrawal.status} />
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-foreground">{formatInr(withdrawal.amount)}</span>
      </div>
      {isRejected && withdrawal.rejectionReason.trim() && (
        <p className="mt-2 rounded-lg bg-error-subtle p-2.5 text-xs leading-relaxed text-error">
          {withdrawal.rejectionReason.trim()}
        </p>
      )}
    </div>
  );
}
