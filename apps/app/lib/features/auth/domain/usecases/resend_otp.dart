import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Resend the OTP over SMS ('text') or a voice call ('voice').
@injectable
class ResendOtp implements UseCase<Unit, ResendOtpParams> {
  ResendOtp(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(ResendOtpParams params) =>
      _repository.resendOtp(params.phone, params.retryType, params.countryCode);
}

class ResendOtpParams extends Equatable {
  const ResendOtpParams({
    required this.phone,
    required this.retryType,
    required this.countryCode,
  });

  final String phone;
  final String retryType;

  /// The dial code the original OTP was sent with.
  final String countryCode;

  @override
  List<Object?> get props => [phone, retryType, countryCode];
}
