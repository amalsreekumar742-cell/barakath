import { CircleDollarSign, Gift, ShieldCheck, ShoppingBag, Undo2 } from 'lucide-react';
import { WalletSource } from '@barakath/shared';

/**
 * One icon per ledger source, fed into the shared `TransactionRow`'s `icon` prop (Batch 4 brief §1).
 * `TransactionRow` itself supplies the neutral circular background — this only picks WHICH glyph, not
 * a colour, since the row component has no per-source tint slot (unlike the Flutter tile, which paints
 * a tinted background per source; that styling choice lives in `TransactionRow` for every list that
 * uses it, not re-invented here).
 *
 * WHY a `default` fallback rather than throwing/omitting: an unknown source (e.g. a future admin build
 * writing a value this bundle doesn't know yet) must still render a row — see `WalletSourceX` in the
 * Flutter app for the identical "render anyway, with the neutral glyph" reasoning.
 */
export function walletTransactionIcon(source: string) {
  switch (source) {
    case WalletSource.UPI_TOP_UP:
      return <CircleDollarSign size={16} aria-hidden />;
    case WalletSource.REWARD:
      return <Gift size={16} aria-hidden />;
    case WalletSource.PURCHASE:
      return <ShoppingBag size={16} aria-hidden />;
    case WalletSource.REFUND:
      return <Undo2 size={16} aria-hidden />;
    case WalletSource.ADMIN:
      return <ShieldCheck size={16} aria-hidden />;
    default:
      return <CircleDollarSign size={16} aria-hidden />;
  }
}
