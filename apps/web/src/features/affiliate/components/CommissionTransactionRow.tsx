import { Heart } from 'lucide-react';
import { format } from 'date-fns';
import type { AffiliateTransactionProps } from '@barakath/shared';
import { StatusBadge } from '@/components/StatusBadge';
import { formatInr } from '@/components/catalog/PriceBlock';
import { commissionStatusLabel } from '../utils/affiliateFormat';

/**
 * One row of the commission ledger (`affiliateTransactions`) — mirrors `commission_tile.dart` 1:1,
 * including showing the WHOLE ledger, not just Referral rows: the query behind this
 * (`affiliateTransactions where userId == uid`) also returns the Debit row admin's `approveWithdrawal`
 * appends (source `Withdrawal`, status `Withdrawn`) and any future `Admin`/`Reversal` row. Per this
 * batch's brief ("no Commission Adjustment row type — if the data contains an adjustment type, render
 * it plainly without special treatment"), this row does exactly that: it never branches on `source`,
 * it just prefers `referredUserName` for the title and falls back to `description`.
 *
 * `TransactionRow` (`features/account/components`) was not reused here — it has no slot for a status
 * pill or a "Clears <date>" line, both required by spec §3.16, so this is a small feature-owned sibling
 * with the same icon/date/signed-amount shape rather than bending the shared component's contract.
 */
export function CommissionTransactionRow({ transaction }: { transaction: AffiliateTransactionProps }) {
  const isCredit = transaction.type === 'Credit';
  const isPending = transaction.status === 'Pending';
  const createdAt = transaction.createdAt.toDate();

  const title = transaction.referredUserName.trim()
    ? `Referral from ${transaction.referredUserName.trim()}`
    : transaction.description.trim() || 'Referral commission';

  const subtitle = transaction.orderId.trim()
    ? `Order #${transaction.orderId} · ${format(createdAt, 'd MMM yyyy')}`
    : format(createdAt, 'd MMM yyyy');

  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
        <Heart size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-xs text-faint">{subtitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusBadge status={commissionStatusLabel(transaction.status)} />
          {isPending && transaction.clearsAt && (
            <span className="text-[11px] text-faint">Clears {format(transaction.clearsAt.toDate(), 'd MMM yyyy')}</span>
          )}
        </div>
      </div>
      <span className={`shrink-0 text-sm font-extrabold ${isCredit ? 'text-success' : 'text-error'}`}>
        {isCredit ? '+' : '-'}
        {formatInr(transaction.amount)}
      </span>
    </div>
  );
}
