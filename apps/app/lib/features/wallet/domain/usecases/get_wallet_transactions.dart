import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/wallet_repository.dart';

class GetWalletTransactionsParams extends Equatable {
  const GetWalletTransactionsParams({
    required this.uid,
    this.startAfter,
    this.limit = 12,
  });

  final String uid;

  /// A previous page's `nextCursor`, or null for the first page.
  final Object? startAfter;
  final int limit;

  @override
  List<Object?> get props => [uid, startAfter, limit];
}

/// One cursor page of the wallet ledger (spec §2.20 transaction history).
@injectable
class GetWalletTransactions
    implements UseCase<WalletTransactionPage, GetWalletTransactionsParams> {
  GetWalletTransactions(this._repository);

  final WalletRepository _repository;

  @override
  Future<Either<Failure, WalletTransactionPage>> call(
    GetWalletTransactionsParams params,
  ) =>
      _repository.fetchTransactions(
        uid: params.uid,
        startAfter: params.startAfter,
        limit: params.limit,
      );
}
