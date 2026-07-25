'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BankAccountProps } from '@barakath/shared';
import { Constants } from '@/config/constants';
import { addBankAccount, deleteBankAccount, listBankAccounts, type NewBankAccount } from '../api/bankAccounts';

export interface UseBankAccountsResult {
  accounts: BankAccountProps[];
  loading: boolean;
  error: string | null;
  /** An add/delete is in flight — drives the form/delete-button spinner. */
  mutating: boolean;
  hasSlot: boolean;
  refresh: () => Promise<void>;
  add: (values: NewBankAccount) => Promise<BankAccountProps>;
  remove: (accountId: string) => Promise<void>;
  isAccountNumberSaved: (accountNumber: string) => boolean;
}

/**
 * Local (non-Redux) data hook over `features/affiliate/api/bankAccounts.ts` — same shape as
 * `features/address/hooks/useAddresses.ts`, which this batch's own notes (§6) point to as the
 * established "just give me the data" pattern for an account-area list that only one screen needs at a
 * time. Shared by the wallet page's "Bank accounts" section and the withdraw page's account picker so
 * both stay in sync without a global slice.
 */
export function useBankAccounts(uid: string | null): UseBankAccountsResult {
  const [accounts, setAccounts] = useState<BankAccountProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAccounts(await listBankAccounts(uid));
    } catch {
      setError('Could not load your bank accounts.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (values: NewBankAccount) => {
      if (!uid) throw new Error('Sign in to add a bank account.');
      setMutating(true);
      try {
        const created = await addBankAccount(uid, values);
        await refresh(); // re-read rather than optimistic append: the cap/duplicate check is server data
        return created;
      } finally {
        setMutating(false);
      }
    },
    [uid, refresh],
  );

  const remove = useCallback(
    async (accountId: string) => {
      if (!uid) return;
      setMutating(true);
      try {
        await deleteBankAccount(uid, accountId);
        await refresh();
      } finally {
        setMutating(false);
      }
    },
    [uid, refresh],
  );

  const isAccountNumberSaved = useCallback(
    (accountNumber: string) => accounts.some((a) => a.accountNumber.trim() === accountNumber.trim()),
    [accounts],
  );

  return {
    accounts,
    loading,
    error,
    mutating,
    hasSlot: accounts.length < Constants.AFFILIATE_MAX_BANK_ACCOUNTS,
    refresh,
    add,
    remove,
    isAccountNumberSaved,
  };
}
