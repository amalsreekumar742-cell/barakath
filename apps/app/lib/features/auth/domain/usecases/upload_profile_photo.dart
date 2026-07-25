import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Upload the avatar bytes to Storage and return the download URL. Keeps the
/// Storage write out of the widget (data layer owns Firebase).
@injectable
class UploadProfilePhoto implements UseCase<String, UploadProfilePhotoParams> {
  UploadProfilePhoto(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, String>> call(UploadProfilePhotoParams params) =>
      _repository.uploadProfilePhoto(params.bytes);
}

class UploadProfilePhotoParams extends Equatable {
  const UploadProfilePhotoParams(this.bytes);

  final Uint8List bytes;

  @override
  List<Object?> get props => [bytes];
}
