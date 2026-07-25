import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/wallet_breakdown.dart';
import '../repositories/wallet_repository.dart';

/// Lifetime Rewards + Refunds totals for the two breakdown tiles (spec §2.20).
@injectable
class GetWalletBreakdown implements UseCase<WalletBreakdown, String> {
  GetWalletBreakdown(this._repository);

  final WalletRepository _repository;

  @override
  Future<Either<Failure, WalletBreakdown>> call(String uid) =>
      _repository.fetchBreakdown(uid);
}
