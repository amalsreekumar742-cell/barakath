import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Persist the (optional, skippable) profile fields for the signed-in user.
@injectable
class CreateProfile implements UseCase<Unit, CreateProfileParams> {
  CreateProfile(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(CreateProfileParams params) =>
      _repository.createProfile(
        fullName: params.fullName,
        email: params.email,
        whatsapp: params.whatsapp,
        friendCode: params.friendCode,
        photoUrl: params.photoUrl,
      );
}

class CreateProfileParams extends Equatable {
  const CreateProfileParams({
    required this.fullName,
    this.email = '',
    this.whatsapp = '',
    this.friendCode = '',
    this.photoUrl,
  });

  final String fullName;
  final String email;
  final String whatsapp;
  final String friendCode;
  final String? photoUrl;

  @override
  List<Object?> get props => [fullName, email, whatsapp, friendCode, photoUrl];
}
