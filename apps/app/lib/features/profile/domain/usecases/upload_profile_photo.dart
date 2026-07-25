import 'dart:io';

import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/profile_repository.dart';

/// Upload a cropped avatar file and return its download URL.
///
/// Separate from [UpdateProfile] on purpose: the upload can succeed while the
/// document write fails (and vice versa), and the UI reports them differently.
@injectable
class UploadProfilePhoto
    implements UseCase<String, UploadProfilePhotoParams> {
  UploadProfilePhoto(this._repository);

  final ProfileRepository _repository;

  @override
  Future<Either<Failure, String>> call(UploadProfilePhotoParams params) =>
      _repository.uploadProfilePhoto(uid: params.uid, file: params.file);
}

class UploadProfilePhotoParams extends Equatable {
  const UploadProfilePhotoParams({required this.uid, required this.file});

  final String uid;
  final File file;

  @override
  List<Object?> get props => [uid, file.path];
}
