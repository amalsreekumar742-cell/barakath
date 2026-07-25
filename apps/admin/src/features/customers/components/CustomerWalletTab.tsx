import { type FC, useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';
import type { UserProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';
import { fetchCustomerWalletTransactions } from '../api/fetchCustomerWalletTransactions';
import AddWalletMoneyModal from './AddWalletMoneyModal';
import { TxnTypeCell, TxnAmount, SourceBadge } from './ui';

/**
 * CustomerWalletTab — the customer's wallet balance + ledger with an "Add money" action (spec §1.8
 * Wallet tab). Loads its first page lazily on mount and paginates via "View More".
 */
const CustomerWalletTab: FC<{ customer: UserProps }> = ({ customer }) => {
  const dispatch = useAppDispatch();
  const {
    walletTransactions,
    walletHasMore,
    walletLoading,
    walletLoadingMore,
    walletLastVisible,
  } = useAppSelector((s) => s.customers);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (walletTransactions.length === 0)
      void dispatch(fetchCustomerWalletTransactions({ userId: customer.id, cursor: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, customer.id]);

  return (
    <div>
      {/* Slim balance header (design: wallet icon + "Normal wallet" + balance). "Add Money" is real,
          working functionality with no design counterpart — kept as a small button on the same row. */}
      <div className="mb-3 flex items-center gap-2.5">
        <Icon name="WalletLine" size={18} className="text-primary" />
        <span className="text-[14px] font-bold text-foreground">Normal wallet</span>
        <span className="ml-auto text-[16px] font-extrabold text-foreground">
          {formatINR(customer.walletBalance ?? 0)}
        </span>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={14} /> Add Money
        </button>
      </div>

      {/* History */}
      {walletLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={44} borderRadius={10} />
          ))}
        </div>
      ) : walletTransactions.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted">No wallet transactions</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full">
            <thead className="border-b border-border bg-subtle/50">
              <tr>
                {['Type', 'Source', 'Balance After', 'Date', 'Amount'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-faint ${i === 4 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {walletTransactions.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3"><TxnTypeCell type={t.type} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={t.source} />
                      {t.description && <span className="text-[12px] text-muted">{t.description}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-foreground">{formatINR(t.balanceAfter ?? 0)}</td>
                  <td className="px-5 py-3 text-[13px] text-muted">
                    {t.createdAt ? format(t.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : '—'}
                  </td>
                  <td className="px-5 py-3 text-right"><TxnAmount type={t.type} amount={t.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {walletLoadingMore && (
            <div className="p-3">
              <Skeleton height={40} borderRadius={8} />
            </div>
          )}
          {walletHasMore && !walletLoadingMore && (
            <div className="flex justify-center border-t border-border p-3">
              <button
                type="button"
                onClick={() =>
                  dispatch(fetchCustomerWalletTransactions({ userId: customer.id, cursor: walletLastVisible }))
                }
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </div>
      )}

      <AddWalletMoneyModal
        isOpen={addOpen}
        customer={customer}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
};

export default CustomerWalletTab;
