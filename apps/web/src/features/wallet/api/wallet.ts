import {
  collection,
  orderBy,
  query,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { FirestoreCollections, type WalletTransactionProps } from '@barakath/shared';
import { db } from '@/lib/firebaseConfig';

/**
 * The wallet ledger query + mapper (Batch 4 brief §1) — the read half of the wallet tab that isn't a
 * Cloud Function or an aggregation.
 *
 * WHY `walletTransactions` is queried as a TOP-LEVEL collection filtered by `userId`, not
 * `users/{uid}/walletTransactions`: spec §4.9 places this ledger under `customers/{customerId}/`, but
 * `firebase/firestore.rules` (verified live, WEB_BATCH4_NOTES.md's own D2 finding matches this) reads:
 *
 *   match /walletTransactions/{txnId} {
 *     allow read: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
 *     allow create: if isAdmin();
 *     allow update, delete: if false;
 *   }
 *
 * — a top-level collection with an owner-scoped rule, exactly matching the Flutter app's own datasource
 * comment (`apps/app/lib/features/wallet/data/datasources/wallet_remote_datasource.dart`). Querying the
 * spec's sub-collection path would silently return an empty result (Firestore does not error on a
 * collection that doesn't exist at that path), rendering a wallet tab that always looks empty.
 *
 * WHY no `limit`/`startAfter` here: this base query feeds `usePaginatedCollection`
 * (`features/account/hooks/usePaginatedCollection.ts`), which owns the pagination mechanics itself —
 * see that hook's own header for why the caller must not pre-limit its query.
 */
export function walletTransactionsQuery(uid: string): Query<DocumentData> {
  return query(
    collection(db, FirestoreCollections.walletTransactions),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
}

/** Maps one `walletTransactions` doc to `WalletTransactionProps` — module-scope so it is a referentially
 *  stable `mapper` for `usePaginatedCollection` (no fresh function identity on every render). */
export function mapWalletTransaction(doc: QueryDocumentSnapshot<DocumentData>): WalletTransactionProps {
  return { ...doc.data(), id: doc.id } as WalletTransactionProps;
}
