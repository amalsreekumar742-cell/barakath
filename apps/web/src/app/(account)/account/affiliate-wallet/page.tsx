'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, orderBy, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { FirestoreCollections } from '@barakath/shared';
import type { AffiliateTransactionProps, AffiliateWithdrawalProps, BankAccountProps } from '@barakath/shared';
import { Plus } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { StatCard } from '@/features/account/components/StatCard';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { usePaginatedCollection } from '@/features/account/hooks/usePaginatedCollection';
import { useAppSelector } from '@/stores/store';
import { db } from '@/lib/firebaseConfig';
import { Constants } from '@/config/constants';
import { toastError, toastSuccess } from '@/lib/toast';
import { AffiliateGuard } from '@/features/affiliate/components/AffiliateGuard';
import { ReferralCodeCard } from '@/features/affiliate/components/ReferralCodeCard';
import { WithdrawPanel } from '@/features/affiliate/components/WithdrawPanel';
import { CommissionTransactionRow } from '@/features/affiliate/components/CommissionTransactionRow';
import { WithdrawalRow } from '@/features/affiliate/components/WithdrawalRow';
import { BankAccountCard } from '@/features/affiliate/components/BankAccountCard';
import { AddBankAccountModal } from '@/features/affiliate/components/AddBankAccountModal';
import { useBankAccounts } from '@/features/affiliate/hooks/useBankAccounts';
import { getThisMonthEarnings } from '@/features/affiliate/api/stats';
import { formatInr } from '@/components/catalog/PriceBlock';

/**
 * /account/affiliate-wallet (spec §3.16) — earnings overview, referral code, commission history,
 * withdrawal history and saved bank accounts, all on the ONE page (unlike Flutter, which spreads this
 * across a dashboard + wallet + bank-accounts screen — spec §3.16 combines them for the website).
 *
 * WHY `pendingCommission`/`confirmedCommission`/`affiliateBalance`/`totalReferrals` are read straight
 * off `s.auth.user` rather than a second Firestore read: `useCurrentUser`'s `onSnapshot` (mounted at the
 * app root) already mirrors `users/{uid}` live into Redux — the exact reasoning
 * `apps/app`'s `AffiliateProvider` documents for doing the same on Flutter's side. A second listener
 * here would double the reads and let two copies of the same document drift.
 *
 * WHY "Lifetime earnings" is `pendingCommission + confirmedCommission` (a live-field sum, NOT an
 * aggregation) even though the brief that scoped this batch asked for a `commissionTransactions`
 * aggregation: verified against `functions/src/growth/processReferralCommission.ts` and
 * `clearAffiliateCommissions.ts` — `confirmedCommission` IS already "lifetime confirmed" (spec §4.9's
 * own field description), and `pendingCommission` is every commission earned but not yet cleared. Their
 * sum is the exact, exhaustive total of every rupee ever earned — computing it via an aggregation query
 * over the ledger would re-derive a number two live fields already give for free, and could only ever
 * disagree with them if the ledger and the running totals ever drifted (which would itself be a bug
 * worth surfacing, not something to paper over with a second, slower source of truth). "This Month" has
 * no equivalent running field anywhere, so THAT one genuinely is a `sum()` aggregation — see
 * `features/affiliate/api/stats.ts`.
 */
export default function AffiliateWalletPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Affiliate Wallet' }]} />
      <AccountPageHeader title="Affiliate Wallet" subtitle="Track your referral earnings and request a payout." />
      <AffiliateGuard>{(user) => <WalletBody uid={user.id} />}</AffiliateGuard>
    </div>
  );
}

const commissionMapper = (doc: QueryDocumentSnapshot<DocumentData>) =>
  ({ ...(doc.data() as Omit<AffiliateTransactionProps, 'id'>), id: doc.id }) as AffiliateTransactionProps;

const withdrawalMapper = (doc: QueryDocumentSnapshot<DocumentData>) =>
  ({ ...(doc.data() as Omit<AffiliateWithdrawalProps, 'id'>), id: doc.id }) as AffiliateWithdrawalProps;

function WalletBody({ uid }: { uid: string }) {
  const user = useAppSelector((s) => s.auth.user);

  const commissionsQuery = useMemo(
    () =>
      query(
        collection(db, FirestoreCollections.affiliateTransactions),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
      ),
    [uid],
  );
  const withdrawalsQuery = useMemo(
    () =>
      query(
        collection(db, FirestoreCollections.affiliateWithdrawals),
        where('userId', '==', uid),
        orderBy('createdAt', 'desc'),
      ),
    [uid],
  );

  const commissions = usePaginatedCollection({ query: commissionsQuery, mapper: commissionMapper });
  const withdrawals = usePaginatedCollection({ query: withdrawalsQuery, mapper: withdrawalMapper });
  const bankAccounts = useBankAccounts(uid);

  const [thisMonth, setThisMonth] = useState<{ loading: boolean; amount: number }>({ loading: true, amount: 0 });
  useEffect(() => {
    let cancelled = false;
    setThisMonth({ loading: true, amount: 0 });
    void getThisMonthEarnings(uid)
      .then((amount) => {
        if (!cancelled) setThisMonth({ loading: false, amount });
      })
      .catch(() => {
        if (!cancelled) setThisMonth({ loading: false, amount: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const [showAddBank, setShowAddBank] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BankAccountProps | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await bankAccounts.remove(pendingDelete.id);
      toastSuccess('Bank account deleted');
      setPendingDelete(null);
    } catch (error) {
      toastError(error, 'Could not delete the bank account.');
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  // Opt-in — see AffiliateGuard. Only an explicit `true` grants wallet access.
  const walletEnabled = user.affiliateEnabled === true;
  const lifetimeEarnings = user.pendingCommission + user.confirmedCommission;

  return (
    <div>
      {/* Main column (hero + stats + history + bank accounts) + a 340px sidebar (referral + withdraw),
          matching design marker 10's layout exactly instead of stacking everything in one column. */}
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <div className="w-full flex-1 space-y-6">
          {/* Earnings overview: a wide "Withdrawable earnings" hero card + Pending + Confirmed,
              1.4fr/1fr/1fr — matching the design's hero-plus-two-tile row exactly. Referrals, Lifetime
              earnings and This month are real, useful figures the design doesn't show on this row;
              kept as a secondary row rather than dropped. */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div className="rounded-2xl bg-gradient-to-br from-[#2a2118] to-[#4a3a22] p-6 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Withdrawable earnings</p>
              <p className="mt-3 font-display text-[38px] font-semibold leading-none">{formatInr(user.affiliateBalance)}</p>
              <p className="mt-2 text-xs text-white/75">Lifetime {formatInr(lifetimeEarnings)} earned</p>
            </div>
            <StatCard
              label="Pending commission"
              value={formatInr(user.pendingCommission)}
              secondary="Clears after delivery"
            />
            <StatCard label="Confirmed" value={formatInr(user.confirmedCommission)} secondary="Ready to withdraw" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="Referrals" value={user.totalReferrals} />
            <StatCard label="Lifetime earnings" value={formatInr(lifetimeEarnings)} />
            <StatCard label="This month" value={thisMonth.loading ? '—' : formatInr(thisMonth.amount)} />
          </div>

          {/* Commission history */}
          <section>
            <h2 className="mb-3 font-display text-base font-semibold text-foreground">
              How you earned · commission history
            </h2>
            <div className="rounded-2xl border border-border bg-surface p-4">
              {commissions.isLoading ? (
                <ListSkeleton />
              ) : commissions.error ? (
                <ErrorNote message={commissions.error} onRetry={commissions.refresh} />
              ) : commissions.items.length === 0 ? (
                <EmptyState title="No commission yet" subtitle="Share your referral code to start earning." />
              ) : (
                <>
                  {commissions.items.map((t) => (
                    <CommissionTransactionRow key={t.id} transaction={t} />
                  ))}
                  {commissions.isLoadingMore && <ListSkeleton count={2} />}
                  {commissions.hasMore && !commissions.isLoadingMore && (
                    <Button variant="secondary" size="sm" onClick={commissions.loadMore} className="mt-3">
                      View more
                    </Button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Withdrawal history */}
          <section>
            <h2 className="mb-3 font-display text-base font-semibold text-foreground">Withdrawal requests</h2>
            <div className="rounded-2xl border border-border bg-surface p-4">
              {withdrawals.isLoading ? (
                <ListSkeleton count={2} />
              ) : withdrawals.error ? (
                <ErrorNote message={withdrawals.error} onRetry={withdrawals.refresh} />
              ) : withdrawals.items.length === 0 ? (
                <EmptyState title="You haven't requested a withdrawal yet" />
              ) : (
                <>
                  {withdrawals.items.map((w) => (
                    <WithdrawalRow key={w.id} withdrawal={w} />
                  ))}
                  {withdrawals.isLoadingMore && <ListSkeleton count={2} />}
                  {withdrawals.hasMore && !withdrawals.isLoadingMore && (
                    <Button variant="secondary" size="sm" onClick={withdrawals.loadMore} className="mt-3">
                      View more
                    </Button>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Bank accounts */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">Bank accounts</h2>
              {bankAccounts.hasSlot && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Plus size={14} />}
                  onClick={() => setShowAddBank(true)}
                  disabled={bankAccounts.loading}
                >
                  Add bank account
                </Button>
              )}
            </div>
            <div className="space-y-3">
              {bankAccounts.loading ? (
                <ListSkeleton count={2} />
              ) : bankAccounts.accounts.length === 0 ? (
                <EmptyState title="No bank account saved yet" subtitle="Your withdrawals are transferred to the account you save here." />
              ) : (
                bankAccounts.accounts.map((account) => (
                  <BankAccountCard
                    key={account.id}
                    account={account}
                    onDelete={bankAccounts.mutating ? undefined : () => setPendingDelete(account)}
                  />
                ))
              )}
              {!bankAccounts.hasSlot && !bankAccounts.loading && (
                <p className="rounded-xl border border-border bg-subtle p-3 text-xs text-muted">
                  You can save up to {Constants.AFFILIATE_MAX_BANK_ACCOUNTS} bank accounts. Delete one to add another.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="w-full space-y-4 lg:w-[340px] lg:shrink-0">
          <ReferralCodeCard code={user.affiliateCode} />
          <WithdrawPanel
            uid={uid}
            userName={user.fullName}
            userPhone={user.phone}
            balance={user.affiliateBalance}
            walletEnabled={walletEnabled}
            bankAccounts={bankAccounts}
            onWithdrawn={() => void withdrawals.refresh()}
          />
        </div>
      </div>

      <AddBankAccountModal
        isOpen={showAddBank}
        onClose={() => setShowAddBank(false)}
        uid={uid}
        existingCount={bankAccounts.accounts.length}
        isAccountNumberSaved={bankAccounts.isAccountNumberSaved}
        onAdded={() => void bankAccounts.refresh()}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete bank account?"
        description={
          pendingDelete
            ? `Remove ${pendingDelete.bankName} ${pendingDelete.accountNumber.slice(-4)}? Withdrawals already filed to it are not affected.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
      />
    </div>
  );
}

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-subtle" />
      ))}
    </div>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-error">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
