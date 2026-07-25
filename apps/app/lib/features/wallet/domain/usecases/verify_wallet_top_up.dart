import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/wallet_repository.dart';

/// The three fields Razorpay's success callback returns. They travel together
/// or not at all — the signature is only meaningful over the other two.
class VerifyWalletTopUpParams extends Equatable {
  const VerifyWalletTopUpParams({
    required this.razorpayOrderId,
    required this.razorpayPaymentId,
    required this.razorpaySignature,
  });

  final String razorpayOrderId;
  final String razorpayPaymentId;
  final String razorpaySignature;

  @override
  List<Object?> get props =>
      [razorpayOrderId, razorpayPaymentId, razorpaySignature];
}

/// Step 2 of "Add money": the server verifies the signature and credits.
///
/// Resolves to the credited amount in rupees. `Right(null)` is a real, expected
/// outcome — a payment whose signature does not check out. Treat it as a failure
/// to the customer, never as a credit.
@injectable
class VerifyWalletTopUp implements UseCase<double?, VerifyWalletTopUpParams> {
  VerifyWalletTopUp(this._repository);

  final WalletRepository _repository;

  @override
  Future<Either<Failure, double?>> call(VerifyWalletTopUpParams params) =>
      _repository.verifyTopUp(
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpaySignature: params.razorpaySignature,
      );
}
