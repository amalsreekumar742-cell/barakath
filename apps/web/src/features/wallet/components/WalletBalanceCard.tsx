import { formatInr } from '@/components/catalog/PriceBlock';

/**
 * The green gradient balance card at the top of the wallet tab (Batch 4 brief §1).
 *
 * WHY "NORMAL WALLET BALANCE" is verbatim: mirrors `apps/app/lib/features/wallet/presentation/widgets/
 * wallet_balance_card.dart` exactly — the all-caps label the Flutter app has used since spec §2.20.
 *
 * WHY the balance is a plain prop rather than this component reading Redux itself: the caller
 * (`/account/wallet`) already reads `state.auth.user.walletBalance` off `AuthListener`'s live
 * `users/{uid}` subscription — the project's established pattern for "the current user's own document
 * is watched, not fetched once" (see `AuthListener.tsx`). A second listener here would be a second
 * subscription for the exact same document.
 */
export interface WalletBalanceCardProps {
  balance: number;
  loading: boolean;
}

export function WalletBalanceCard({ balance, loading }: WalletBalanceCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white">
      {/* The soft circle bleeding off the top-right — matches the Flutter card's decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-40 rounded-full bg-white/10"
      />
      <div className="relative">
        <p className="text-xs font-semibold tracking-[0.08em] text-white/85">NORMAL WALLET BALANCE</p>
        {loading ? (
          <div className="mt-2 h-9 w-40 animate-pulse rounded-md bg-white/20" aria-hidden />
        ) : (
          <p className="mt-2 font-display text-4xl font-extrabold tracking-tight">{formatInr(balance)}</p>
        )}
        <p className="mt-1 text-sm text-white/85">Never expires — use it at checkout on any order</p>
      </div>
    </div>
  );
}
