import { Timestamp, collection, getAggregateFromServer, query, sum, where } from 'firebase/firestore';
import { AffiliateTransactionSource, FirestoreCollections } from '@barakath/shared';
import { startOfMonth } from 'date-fns';
import { db } from '@/lib/firebaseConfig';

/**
 * "This Month" — spec §3.16/§3.24, a website-only figure (Flutter's dashboard has no month-to-date
 * line at all: `affiliate_stat_cards.dart`'s own comment says "no month-to-date field exists in the
 * schema"). There is genuinely no running field for it anywhere, so — unlike "Lifetime earnings" (see
 * the wallet page's own comment) — this ONE figure really does need a server-side aggregation.
 *
 * WHY `getAggregateFromServer` + `sum()`, never a client-side loop: the react-nextjs skill mandates
 * aggregation queries for any sum/count/average over a collection — the whole month's rows are summed
 * server-side and only the one total is transmitted, never fetched document-by-document.
 *
 * WHY bounded to `source == 'Referral'`: the ledger also carries Debit rows (a withdrawal being
 * approved, source `'Withdrawal'`) and could in principle carry `'Admin'`/`'Reversal'` rows — "earnings
 * this month" means commission actually earned from a referred sale, not the whole ledger's net motion.
 * This is a judgement call flagged in the close-out doc: earning entries only, not the whole ledger.
 *
 * WHY "the current calendar month in the customer's local timezone": `new Date()` and `date-fns`'
 * `startOfMonth`/`addMonths` both operate in the BROWSER's local timezone by construction (there is no
 * server-side clock or UTC conversion involved on the client) — so the boundary here already IS "the
 * user's local calendar month" with no extra timezone handling needed. `Timestamp.fromDate` then encodes
 * that same local instant as the UTC-based Firestore Timestamp for the range comparison.
 */
export async function getThisMonthEarnings(uid: string): Promise<number> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1));

  const q = query(
    collection(db, FirestoreCollections.affiliateTransactions),
    where('userId', '==', uid),
    where('source', '==', AffiliateTransactionSource.REFERRAL),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<', Timestamp.fromDate(nextMonthStart)),
  );

  const snap = await getAggregateFromServer(q, { total: sum('amount') });
  return snap.data().total ?? 0;
}
