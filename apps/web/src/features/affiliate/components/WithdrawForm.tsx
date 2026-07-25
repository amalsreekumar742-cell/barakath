'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { BankAccountProps } from '@barakath/shared';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatInr } from '@/components/catalog/PriceBlock';
import { Constants } from '@/config/constants';
import { toastError, toastSuccess } from '@/lib/toast';
import { BankAccountCard } from './BankAccountCard';
import { AddBankAccountModal } from './AddBankAccountModal';
import type { UseBankAccountsResult } from '../hooks/useBankAccounts';
import { createWithdrawal } from '../api/withdrawals';

/** ₹1,000 and ₹5,000 sit BELOW the ₹10,000 minimum on purpose (spec §2.22's own quick-pill set) —
 *  validation rejects them with the real reason rather than the screen pretending they don't exist. */
const QUICK_AMOUNTS = [1000, 5000];

/**
 * WithdrawForm — the amount + bank-account + summary form (design marker 34, "Complete withdrawal").
 * Extracted from the standalone `/withdraw` page so the affiliate wallet page can also render it
 * INLINE (design marker 24 shows "Withdraw funds" as a panel on the same screen as the referral code,
 * not a separate page) — see `WithdrawPanel.tsx`, the inline wrapper that expands into this.
 */
export function WithdrawForm({
  uid,
  userName,
  userPhone,
  balance,
  bankAccounts,
  onSuccess,
  onCancel,
}: {
  uid: string;
  userName: string;
  userPhone: string;
  balance: number;
  bankAccounts: UseBankAccountsResult;
  onSuccess: () => void;
  onCancel?: () => void;
}) {
  const [amountText, setAmountText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(bankAccounts.accounts[0]?.id ?? null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [showAddBank, setShowAddBank] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const amount = Number(amountText.replace(/[^0-9]/g, '')) || 0;
  const netAmount = Math.max(0, amount - Constants.AFFILIATE_PROCESSING_FEE);
  const selectedAccount = bankAccounts.accounts.find((a) => a.id === selectedId) ?? null;

  function applyQuickAmount(value: number) {
    setAmountText(String(Math.floor(value)));
    setAmountError(null);
  }

  function validate(account: BankAccountProps | null): boolean {
    let ok = true;
    if (amount <= 0) {
      setAmountError('Enter an amount to withdraw.');
      ok = false;
    } else if (amount < Constants.AFFILIATE_MIN_WITHDRAWAL) {
      setAmountError(`The minimum withdrawal is ${formatInr(Constants.AFFILIATE_MIN_WITHDRAWAL)}.`);
      ok = false;
    } else if (amount > balance) {
      setAmountError(`That is more than your withdrawable balance of ${formatInr(balance)}.`);
      ok = false;
    } else {
      setAmountError(null);
    }
    if (!account) {
      setAccountError('Choose a bank account.');
      ok = false;
    } else {
      setAccountError(null);
    }
    return ok;
  }

  function handleConfirmPressed() {
    if (!validate(selectedAccount)) return;
    setConfirmOpen(true);
  }

  async function submit() {
    if (!selectedAccount) return;
    setSubmitting(true);
    try {
      await createWithdrawal({
        uid,
        userName,
        userPhone,
        amount,
        account: selectedAccount,
      });
      toastSuccess('Withdrawal request submitted');
      setConfirmOpen(false);
      onSuccess();
    } catch (error) {
      toastError(error, 'Could not file the withdrawal request. Please check the amount and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Amount to withdraw</p>
        <div className="flex items-center rounded-md border border-border-strong bg-surface px-3">
          <span className="text-lg font-semibold text-foreground">₹</span>
          <input
            inputMode="numeric"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value.replace(/[^0-9]/g, ''));
              setAmountError(null);
            }}
            placeholder="0"
            className="h-12 w-full border-0 bg-transparent px-2 text-lg font-semibold text-foreground outline-none"
          />
        </div>
        {amountError && <p className="mt-1 text-xs font-medium text-error">{amountError}</p>}

        <div className="mt-2.5 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => applyQuickAmount(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
                amount === value ? 'bg-primary text-white' : 'bg-primary-subtle text-primary'
              }`}
            >
              {formatInr(value)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyQuickAmount(Math.floor(balance))}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              amount > 0 && amount === Math.floor(balance) ? 'bg-primary text-white' : 'bg-primary-subtle text-primary'
            }`}
          >
            All
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">To bank account</p>
          {bankAccounts.hasSlot && (
            <button
              type="button"
              onClick={() => setShowAddBank(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus size={13} aria-hidden />
              Add bank account
            </button>
          )}
        </div>

        {bankAccounts.loading ? (
          <div className="h-20 animate-pulse rounded-xl bg-subtle" aria-busy="true" />
        ) : bankAccounts.accounts.length === 0 ? (
          <div className="rounded-xl bg-subtle p-4 text-center text-sm text-muted">
            No bank account saved yet. Add one to receive your withdrawal.
          </div>
        ) : (
          <div className="space-y-2.5">
            {bankAccounts.accounts.map((account) => (
              <BankAccountCard
                key={account.id}
                account={account}
                selectable
                showIfsc={false}
                isSelected={selectedId === account.id}
                onSelect={() => {
                  setSelectedId(account.id);
                  setAccountError(null);
                }}
              />
            ))}
          </div>
        )}
        {accountError && <p className="mt-1.5 text-xs font-medium text-error">{accountError}</p>}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <SummaryRow label="Withdrawal amount" value={formatInr(amount)} />
        <SummaryRow label="Processing fee" value={formatInr(Constants.AFFILIATE_PROCESSING_FEE)} />
        <div className="my-2 border-t border-border" />
        <SummaryRow label="Net amount" value={formatInr(netAmount)} emphasis />
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel} className="shrink-0">
            Cancel
          </Button>
        )}
        <Button variant="primary" size="lg" fullWidth onClick={handleConfirmPressed}>
          Confirm withdrawal
        </Button>
      </div>

      <AddBankAccountModal
        isOpen={showAddBank}
        onClose={() => setShowAddBank(false)}
        uid={uid}
        existingCount={bankAccounts.accounts.length}
        isAccountNumberSaved={bankAccounts.isAccountNumberSaved}
        onAdded={(created) => {
          void bankAccounts.refresh();
          setSelectedId(created.id);
        }}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Confirm withdrawal"
        description={
          selectedAccount
            ? `Request ${formatInr(amount)} to ${selectedAccount.bankName} ${selectedAccount.accountNumber.slice(-4)}? Our team reviews and transfers it to this account.`
            : undefined
        }
        confirmLabel="Confirm"
        loading={submitting}
        onConfirm={submit}
        onClose={() => {
          if (!submitting) setConfirmOpen(false);
        }}
      />
    </div>
  );
}

function SummaryRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${emphasis ? 'font-semibold text-foreground' : 'text-muted'}`}>{label}</span>
      <span className={`text-sm ${emphasis ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
