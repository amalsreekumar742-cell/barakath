import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/affiliate_transaction.dart';
import '../entities/affiliate_withdrawal.dart';
import '../entities/bank_account.dart';
import '../entities/ifsc_details.dart';

/// One cursor-paginated page of affiliate rows.
///
/// [nextCursor] is deliberately opaque (`Object?`): it is a Firestore
/// `DocumentSnapshot` created in — and only ever read back by — the data layer,
/// so the domain never depends on the Firestore SDK. The same shape the
/// catalogue uses (`ProductPageResult`); there is no shared `PaginatedResult`
/// in `core/` yet.
class AffiliatePage<T> {
  const AffiliatePage({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  const AffiliatePage.empty()
      : items = const [],
        nextCursor = null,
        hasMore = false;

  final List<T> items;
  final Object? nextCursor;
  final bool hasMore;
}

/// Everything the affiliate surfaces read or write (spec §2.22).
///
/// The app NEVER writes `affiliateBalance`, `pendingCommission` or
/// `confirmedCommission` — those are server/admin owned. The only write here
/// that touches money is filing a withdrawal REQUEST, which the Firestore rule
/// re-validates against the server's copy of the balance.
abstract class AffiliateRepository {
  /// One page of the commission ledger (`affiliateTransactions` where
  /// `userId == uid`, newest first).
  Future<Either<Failure, AffiliatePage<AffiliateTransaction>>> fetchCommissions({
    required String uid,
    Object? startAfter,
    int limit,
  });

  /// One page of payout requests (`affiliateWithdrawals` where
  /// `userId == uid`, newest first).
  Future<Either<Failure, AffiliatePage<AffiliateWithdrawal>>> fetchWithdrawals({
    required String uid,
    Object? startAfter,
    int limit,
  });

  /// Saved payout accounts, oldest first. Capped at 2 by the product, so this
  /// is a bounded read and needs no cursor.
  Future<Either<Failure, List<BankAccount>>> fetchBankAccounts(String uid);

  /// Saves a payout account. Fails when 2 already exist or the account number
  /// is already saved.
  Future<Either<Failure, BankAccount>> addBankAccount({
    required String uid,
    required BankAccount account,
  });

  Future<Either<Failure, Unit>> deleteBankAccount({
    required String uid,
    required String accountId,
  });

  /// Files a payout request. Admin approves and transfers outside the system.
  Future<Either<Failure, Unit>> createWithdrawal(AffiliateWithdrawal request);

  /// Resolves an IFSC code to its bank and branch.
  Future<Either<Failure, IfscDetails>> verifyIfsc(String ifsc);
}
