import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Verify an OTP and sign in. Yields `true` when the account is brand-new.
@injectable
class VerifyOtp implements UseCase<bool, VerifyOtpParams> {
  VerifyOtp(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, bool>> call(VerifyOtpParams params) =>
      _repository.verifyOtp(params.phone, params.otp, params.countryCode);
}

class VerifyOtpParams extends Equatable {
  const VerifyOtpParams({
    required this.phone,
    required this.otp,
    required this.countryCode,
  });

  final String phone;
  final String otp;

  /// Must match the code the OTP was sent with, or the callable can't find the
  /// pending verification.
  final String countryCode;

  @override
  List<Object?> get props => [phone, otp, countryCode];
}
