import { Landmark, Trash2 } from 'lucide-react';
import type { BankAccountProps } from '@barakath/shared';
import { maskAccountNumber } from '../utils/affiliateFormat';

/**
 * A saved payout account, in two shapes (mirrors `bank_account_card.dart`):
 *  - manage (`onDelete` set) — the "Bank accounts" section on the wallet page.
 *  - choose (`selectable`) — the radio card on the withdraw page.
 * The account number is only ever rendered through `maskAccountNumber`.
 */
export function BankAccountCard({
  account,
  selectable = false,
  isSelected = false,
  onSelect,
  onDelete,
  showIfsc = true,
}: {
  account: BankAccountProps;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  showIfsc?: boolean;
}) {
  const body = (
    <>
      {selectable ? (
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
            isSelected ? 'border-primary bg-primary' : 'border-border-strong'
          }`}
          aria-hidden
        >
          {isSelected && <span className="size-2 rounded-full bg-white" />}
        </span>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
          <Landmark size={17} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">
          {`${account.bankName} ${maskAccountNumber(account.accountNumber)}`.trim()}
        </p>
        <p className="truncate text-xs text-muted">{account.accountHolderName}</p>
        {showIfsc && account.ifscCode && (
          <p className="mt-0.5 truncate text-[11px] text-faint">
            {account.bankBranch.trim()
              ? `IFSC ${account.ifscCode} · ${account.bankBranch}`
              : `IFSC ${account.ifscCode}`}
          </p>
        )}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete account"
          className="shrink-0 rounded-md p-2 text-error hover:bg-error-subtle"
        >
          <Trash2 size={18} aria-hidden />
        </button>
      )}
    </>
  );

  const className = `flex items-center gap-3 rounded-xl border bg-surface p-3.5 ${
    selectable && isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
  }`;

  if (selectable) {
    return (
      <button type="button" onClick={onSelect} className={`${className} w-full text-left`}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}
