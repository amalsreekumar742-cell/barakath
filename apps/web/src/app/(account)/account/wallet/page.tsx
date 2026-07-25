'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Ticket, Wallet as WalletIcon } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { formatInr } from '@/components/catalog/PriceBlock';
import { AccountPageHeader } from '@/features/account/components/AccountPageHeader';
import { StatCard } from '@/features/account/components/StatCard';
import { TransactionRow } from '@/features/account/components/TransactionRow';
import { usePaginatedCollection } from '@/features/account/hooks/usePaginatedCollection';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { mapWalletTransaction, walletTransactionsQuery } from '@/features/wallet/api/wallet';
import { fetchWalletBreakdown, fetchWalletSettings } from '@/features/wallet/api/walletThunks';
import { AddMoneyModal } from '@/features/wallet/components/AddMoneyModal';
import { SpinWinPromoCard } from '@/features/wallet/components/SpinWinPromoCard';
import { WalletBalanceCard } from '@/features/wallet/components/WalletBalanceCard';
import { walletTransactionIcon } from '@/features/wallet/components/walletTransactionIcon';

const WALLET_DISABLED_MESSAGE =
  'Wallet payments are currently switched off by the store. Your balance is safe and never expires.';

/**
 * /account/wallet (spec §3.13) — balance, Add money, the Rewards/Refunds breakdown, the Spin & Win
 * promo card, a link into the coupon wallet, and the paginated transaction history.
 *
 * WHY no guest fallback here (unlike the Flutter tab's own login-prompt branch): `(account)/layout.tsx`
 * already sits behind `src/middleware.ts`'s `PROTECTED_PREFIXES` — a signed-out visitor is redirected
 * before this page ever mounts, so a second gate here would just be dead code (same reasoning the
 * layout's own header comment gives for every other /account/* screen).
 *
 * WHY the balance is read off `state.auth.user.walletBalance` rather than a fresh `onSnapshot` here:
 * `AuthListener` already keeps `users/{uid}` live in Redux the moment auth resolves (mounted once, high
 * in the tree — see that file). A second listener on the same document would be a second subscription
 * for the exact same data, billed and maintained twice for no benefit.
 */
export default function WalletPage() {
  const dispatch = useAppDispatch();
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const user = useAppSelector((s) => s.auth.user);
  const { rewardsTotal, breakdownLoading, walletPaymentsEnabled } = useAppSelector((s) => s.wallet);

  const [addMoneyOpen, setAddMoneyOpen] = useState(false);

  // general/config's wallet-enabled flag — read once; the button is disabled the whole time it hasn't
  // resolved `true` (never a loading flash of "here's why you can't" before we actually know).
  useEffect(() => {
    dispatch(fetchWalletSettings());
  }, [dispatch]);

  // Lifetime Rewards + Refunds aggregates — one read per mount, refreshed if the signed-in uid changes.
  useEffect(() => {
    if (uid) dispatch(fetchWalletBreakdown(uid));
  }, [dispatch, uid]);

  const query = useMemo(() => (uid ? walletTransactionsQuery(uid) : null), [uid]);
  const { items, isLoading, isLoadingMore, hasMore, loadMore, error } = usePaginatedCollection({
    query,
    mapper: mapWalletTransaction,
  });

  const canTopUp = walletPaymentsEnabled === true;
  // Only asserted once the flag is confirmed OFF — `null` (still loading, or the read failed) shows no
  // reason at all rather than a false "switched off" flash before the real answer arrives.
  const confirmedDisabled = walletPaymentsEnabled === false;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Wallet' }]} />
      <AccountPageHeader title="Wallet" subtitle="Your normal wallet balance, rewards and transaction history." />

      {/* Main column + 320px sidebar, matching design marker 09's layout. */}
      <div className="flex flex-col items-start gap-5 lg:flex-row">
        <div className="w-full flex-1 space-y-5">
          <WalletBalanceCard
            balance={user?.walletBalance ?? 0}
            loading={authLoading}
            action={
              <Button variant="primary" disabled={!canTopUp} onClick={() => setAddMoneyOpen(true)}>
                Add money
              </Button>
            }
          />
          {confirmedDisabled && <p className="text-xs leading-relaxed text-muted">{WALLET_DISABLED_MESSAGE}</p>}

          {/* Rewards received — the design's tile row also has Refunds/Cashback, but cashback is
           *  removed from the product (see above) and refunds is intentionally not shown here either. */}
          <StatCard
            label="Rewards received"
            value={breakdownLoading ? <SkeletonText width="w-20" /> : formatInr(rewardsTotal)}
          />

          <Link
            href="/account/wallet/coupons"
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 text-sm font-medium text-foreground hover:bg-subtle"
          >
            <span className="flex items-center gap-2">
              <Ticket size={16} className="text-primary" aria-hidden />
              My coupon wallet
            </span>
            <ChevronRight size={16} className="text-faint" aria-hidden />
          </Link>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-1 font-display text-base font-semibold text-foreground">Transaction history</h2>

            {isLoading ? (
              <div className="space-y-1" aria-busy="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                    <div className="size-9 shrink-0 animate-pulse rounded-full bg-subtle" aria-hidden />
                    <div className="flex-1 space-y-2">
                      <SkeletonText width="w-1/3" />
                      <SkeletonText width="w-1/4" />
                    </div>
                    <SkeletonText width="w-14" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <EmptyState icon={<WalletIcon size={40} />} title="Could not load your transactions" subtitle={error} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<WalletIcon size={40} />}
                title="No transactions yet"
                subtitle="Rewards, refunds and order payments will show up here."
              />
            ) : (
              <>
                <div>
                  {items.map((txn) => (
                    <TransactionRow
                      key={txn.id}
                      icon={walletTransactionIcon(txn.source)}
                      label={txn.description?.trim() || txn.source}
                      date={txn.createdAt}
                      type={txn.type}
                      amount={txn.amount}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="secondary" onClick={loadMore} loading={isLoadingMore}>
                      View more
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[320px] lg:shrink-0">
          <SpinWinPromoCard />
        </div>
      </div>

      <AddMoneyModal isOpen={addMoneyOpen} onClose={() => setAddMoneyOpen(false)} />
    </div>
  );
}
