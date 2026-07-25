import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/profile_repository.dart';

/// Save the customer-editable profile fields (spec §2.21 Edit profile).
///
/// The login phone is deliberately absent: it is the account identity, set by
/// the OTP flow, and changing it would silently re-point the account.
@injectable
class UpdateProfile implements UseCase<Unit, UpdateProfileParams> {
  UpdateProfile(this._repository);

  final ProfileRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(UpdateProfileParams params) =>
      _repository.updateProfile(
        uid: params.uid,
        fullName: params.fullName,
        whatsapp: params.whatsapp,
        email: params.email,
        photoUrl: params.photoUrl,
      );
}

class UpdateProfileParams extends Equatable {
  const UpdateProfileParams({
    required this.uid,
    required this.fullName,
    required this.whatsapp,
    required this.email,
    this.photoUrl,
  });

  final String uid;
  final String fullName;
  final String whatsapp;
  final String email;

  /// Null leaves the existing avatar alone — clearing a photo is not an action
  /// the design offers.
  final String? photoUrl;

  @override
  List<Object?> get props => [uid, fullName, whatsapp, email, photoUrl];
}
