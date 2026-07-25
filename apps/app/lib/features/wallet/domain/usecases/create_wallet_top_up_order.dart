import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/wallet_top_up_order.dart';
import '../repositories/wallet_repository.dart';

/// Step 1 of "Add money" (spec §2.20): ask the server to open a Razorpay order.
///
/// Nothing is credited here. The server fixes the amount before the customer
/// pays, precisely so the credit that follows cannot be argued with.
@injectable
class CreateWalletTopUpOrder implements UseCase<WalletTopUpOrder, double> {
  CreateWalletTopUpOrder(this._repository);

  final WalletRepository _repository;

  @override
  Future<Either<Failure, WalletTopUpOrder>> call(double amount) =>
      _repository.createTopUpOrder(amount);
}
