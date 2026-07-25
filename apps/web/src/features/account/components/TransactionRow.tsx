import type { ReactNode } from 'react';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import { formatInr } from '@/components/catalog/PriceBlock';

/**
 * One ledger row — wallet transactions, commission transactions and withdrawal requests all render
 * through this (Batch 4 brief §5), so the same icon/date/signed-amount shape reads identically across
 * all three lists. `type` is caller-supplied rather than read off a specific doc shape on purpose:
 * `WalletTransactionProps`/`AffiliateTransactionProps` both carry a `type: 'Credit' | 'Debit'` field,
 * but `AffiliateWithdrawalProps` has none (a withdrawal is always a debit from the withdrawable
 * balance) — the caller decides, this component only renders the decision.
 */
export interface TransactionRowProps {
  icon: ReactNode;
  label: string;
  date: Timestamp | Date;
  type: 'Credit' | 'Debit';
  amount: number;
  /** Optional secondary line appended after the date — an order id, a status note, a bank name. */
  description?: string;
}

export function TransactionRow({ icon, label, date, type, amount, description }: TransactionRowProps) {
  const isCredit = type === 'Credit';
  const jsDate = date instanceof Date ? date : date.toDate();

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 truncate text-xs text-faint">
          {format(jsDate, 'd MMM yyyy, h:mm a')}
          {description ? ` · ${description}` : ''}
        </p>
      </div>
      <span className={`shrink-0 text-sm font-semibold ${isCredit ? 'text-success' : 'text-error'}`}>
        {isCredit ? '+' : '-'}
        {formatInr(amount)}
      </span>
    </div>
  );
}
