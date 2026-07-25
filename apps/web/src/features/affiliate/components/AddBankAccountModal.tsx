'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2 } from 'lucide-react';
import type { BankAccountProps } from '@barakath/shared';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/Button';
import { Input } from '@/components/form/Field';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toastError, toastSuccess } from '@/lib/toast';
import { bankAccountFormSchema, type BankAccountFormValues } from '../utils/bankAccountSchema';
import { verifyIfsc, type IfscDetails } from '../api/ifsc';
import { addBankAccount } from '../api/bankAccounts';
import { Constants } from '@/config/constants';

/**
 * "Add bank account" (spec §2.22, design frame "30 · Add bank account"): holder name, account number
 * entered twice, and an IFSC verified against Razorpay's directory on blur — the resolved bank/branch
 * are what get stored, so the customer never types a bank name. Mirrors
 * `add_bank_account_page.dart`'s flow (verify-before-submit, a confirm dialog naming the resolved bank).
 *
 * WHY a Modal rather than a route (`apps/app` uses a separate page): spec §3.16 keeps bank accounts as
 * a SECTION of the one combined `/account/affiliate-wallet` page on the website (unlike Flutter's
 * separate dashboard/wallet/bank-accounts screens) — matching the addresses page's own "Add" modal
 * pattern (`(account)/account/addresses/page.tsx`) keeps this consistent with the rest of the site
 * rather than inventing a fourth affiliate route.
 */
export function AddBankAccountModal({
  isOpen,
  onClose,
  uid,
  existingCount,
  isAccountNumberSaved,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  existingCount: number;
  isAccountNumberSaved: (accountNumber: string) => boolean;
  onAdded: (account: BankAccountProps) => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BankAccountFormValues>({ resolver: zodResolver(bankAccountFormSchema) });

  const [ifscState, setIfscState] = useState<{
    loading: boolean;
    details: IfscDetails | null;
    error: string | null;
    verifiedFor: string;
  }>({ loading: false, details: null, error: null, verifiedFor: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pendingSave, setPendingSave] = useState<BankAccountFormValues | null>(null);

  const ifscValue = (watch('ifscCode') ?? '').trim().toUpperCase();

  function handleClose() {
    if (submitting) return;
    reset();
    setIfscState({ loading: false, details: null, error: null, verifiedFor: '' });
    setPendingSave(null);
    onClose();
  }

  async function runIfscLookup() {
    const code = ifscValue;
    if (code.length !== 11 || code === ifscState.verifiedFor) return;
    setIfscState((s) => ({ ...s, loading: true, error: null, details: null }));
    try {
      const details = await verifyIfsc(code);
      setIfscState({ loading: false, details, error: null, verifiedFor: details.ifsc });
    } catch (error) {
      setIfscState({
        loading: false,
        details: null,
        error: error instanceof Error ? error.message : 'Could not verify the IFSC code.',
        verifiedFor: '',
      });
    }
  }

  function onSubmit(values: BankAccountFormValues) {
    if (existingCount >= Constants.AFFILIATE_MAX_BANK_ACCOUNTS) {
      toastError(null, `You can save up to ${Constants.AFFILIATE_MAX_BANK_ACCOUNTS} bank accounts. Delete one to add another.`);
      return;
    }
    if (isAccountNumberSaved(values.accountNumber)) {
      toastError(null, 'This bank account is already saved.');
      return;
    }
    if (ifscState.verifiedFor !== values.ifscCode.toUpperCase() || !ifscState.details) {
      toastError(null, 'Verify the IFSC code before saving.');
      return;
    }
    setPendingSave(values);
  }

  async function confirmSave() {
    if (!pendingSave || !ifscState.details) return;
    setSubmitting(true);
    try {
      const created = await addBankAccount(uid, {
        accountHolderName: pendingSave.accountHolderName,
        accountNumber: pendingSave.accountNumber,
        ifscCode: ifscState.details.ifsc,
        bankName: ifscState.details.bank,
        bankBranch: ifscState.details.branch,
      });
      toastSuccess('Bank account saved');
      onAdded(created);
      setPendingSave(null);
      handleClose();
    } catch (error) {
      toastError(error, 'Could not save the bank account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-lg" labelledBy="add-bank-heading">
        <div className="max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-lg">
          <h2 id="add-bank-heading" className="font-display text-lg font-extrabold text-foreground">
            Add bank account
          </h2>
          <p className="mt-1 text-sm text-muted">Withdraw your affiliate earnings straight to this account.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4" noValidate>
            <Input
              label="Account holder name"
              placeholder="As printed on your passbook"
              error={errors.accountHolderName?.message}
              {...register('accountHolderName')}
            />
            <Input
              label="Account number"
              placeholder="Enter account number"
              inputMode="numeric"
              error={errors.accountNumber?.message}
              {...register('accountNumber')}
            />
            <Input
              label="Re-enter account number"
              placeholder="Re-enter account number"
              inputMode="numeric"
              error={errors.confirmAccountNumber?.message}
              {...register('confirmAccountNumber')}
            />
            <div>
              <Input
                label="IFSC code"
                placeholder="e.g. HDFC0001234"
                maxLength={11}
                error={errors.ifscCode?.message}
                {...register('ifscCode', {
                  onBlur: runIfscLookup,
                  onChange: () => setIfscState((s) => (s.details || s.error ? { ...s, details: null, error: null, verifiedFor: '' } : s)),
                })}
                className="uppercase"
              />
              {ifscState.loading && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                  Verifying…
                </p>
              )}
              {ifscState.details && (
                <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-subtle p-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{ifscState.details.bank}</p>
                    <p className="truncate text-[11px] text-muted">
                      {ifscState.details.branch ? `${ifscState.details.branch} · verified from IFSC` : 'Verified from IFSC'}
                    </p>
                  </div>
                </div>
              )}
              {ifscState.error && <p className="mt-1.5 text-xs text-error">{ifscState.error}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" size="lg" fullWidth>
                Save account
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={pendingSave !== null}
        title="Save bank account?"
        description={
          pendingSave && ifscState.details
            ? `Save ${ifscState.details.bank} · ${pendingSave.accountHolderName}? Withdrawals you request will be transferred to this account.`
            : undefined
        }
        confirmLabel="Save"
        loading={submitting}
        onConfirm={confirmSave}
        onClose={() => {
          if (!submitting) setPendingSave(null);
        }}
      />
    </>
  );
}
