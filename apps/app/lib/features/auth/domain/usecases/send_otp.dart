import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Request an OTP for a phone number.
@injectable
class SendOtp implements UseCase<Unit, SendOtpParams> {
  SendOtp(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(SendOtpParams params) =>
      _repository.sendOtp(params.phone, params.countryCode);
}

class SendOtpParams extends Equatable {
  const SendOtpParams(this.phone, this.countryCode);

  final String phone;

  /// Dial code the number belongs to (e.g. `+91`), chosen on the login screen.
  final String countryCode;

  @override
  List<Object?> get props => [phone, countryCode];
}
