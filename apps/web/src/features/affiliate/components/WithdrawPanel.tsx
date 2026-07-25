'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/Button';
import { formatInr } from '@/components/catalog/PriceBlock';
import { Constants } from '@/config/constants';
import { BankAccountCard } from './BankAccountCard';
import { AddBankAccountModal } from './AddBankAccountModal';
import { WithdrawForm } from './WithdrawForm';
import type { UseBankAccountsResult } from '../hooks/useBankAccounts';

/**
 * WithdrawPanel — the "Withdraw funds" card on the affiliate wallet page (design marker 24, "Referral
 * & withdraw"). Design draws this alongside the referral code card, not as a separate screen; the
 * dedicated `/withdraw` route (design marker 34) still exists as a direct link, but the primary path is
 * this inline card: a compact balance + bank-account summary that expands in place into the full
 * `WithdrawForm` when "Request withdrawal" is pressed — no navigation away from the wallet page.
 */
export function WithdrawPanel({
  uid,
  userName,
  userPhone,
  balance,
  walletEnabled,
  bankAccounts,
  onWithdrawn,
}: {
  uid: string;
  userName: string;
  userPhone: string;
  balance: number;
  walletEnabled: boolean;
  bankAccounts: UseBankAccountsResult;
  onWithdrawn: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);

  const canWithdraw = walletEnabled && balance >= Constants.AFFILIATE_MIN_WITHDRAWAL;
  const primaryAccount = bankAccounts.accounts[0] ?? null;

  if (expanded) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="mb-4 font-display text-base font-extrabold text-foreground">Withdraw funds</h3>
        <WithdrawForm
          uid={uid}
          userName={userName}
          userPhone={userPhone}
          balance={balance}
          bankAccounts={bankAccounts}
          onCancel={() => setExpanded(false)}
          onSuccess={() => {
            setExpanded(false);
            onWithdrawn();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-display text-base font-extrabold text-foreground">Withdraw funds</h3>

      <div className="py-1 text-center">
        <p className="text-xs text-faint">Available</p>
        <p className="mt-1.5 font-display text-3xl font-extrabold text-gold-strong">{formatInr(balance)}</p>
      </div>

      {bankAccounts.loading ? (
        <div className="h-16 animate-pulse rounded-xl bg-subtle" aria-busy="true" />
      ) : primaryAccount ? (
        <BankAccountCard account={primaryAccount} showIfsc={false} />
      ) : (
        <p className="rounded-xl bg-subtle p-3 text-center text-xs text-muted">No bank account saved yet.</p>
      )}

      {bankAccounts.hasSlot && (
        <button
          type="button"
          onClick={() => setShowAddBank(true)}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong py-3 text-sm font-medium text-primary hover:bg-primary-subtle"
        >
          <Plus size={16} aria-hidden />
          Add bank account
        </button>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canWithdraw || !primaryAccount}
        onClick={() => setExpanded(true)}
      >
        Request withdrawal
      </Button>

      {!walletEnabled ? (
        <p className="text-xs leading-relaxed text-muted">
          Your commission keeps building up. The affiliate wallet and withdrawals are switched off for
          your account right now — please contact support to have them enabled.
        </p>
      ) : !canWithdraw ? (
        <p className="text-xs leading-relaxed text-muted">
          You can withdraw once your withdrawable balance reaches {formatInr(Constants.AFFILIATE_MIN_WITHDRAWAL)}.
        </p>
      ) : null}

      <AddBankAccountModal
        isOpen={showAddBank}
        onClose={() => setShowAddBank(false)}
        uid={uid}
        existingCount={bankAccounts.accounts.length}
        isAccountNumberSaved={bankAccounts.isAccountNumberSaved}
        onAdded={() => void bankAccounts.refresh()}
      />
    </div>
  );
}
