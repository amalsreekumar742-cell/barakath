import 'dart:io';

import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../auth/domain/entities/user.dart';
import '../../domain/repositories/profile_repository.dart';
import '../datasources/profile_remote_datasource.dart';

/// Converts the datasource's exceptions into `Failure`s — no exception escapes
/// into the domain or presentation layers.
@LazySingleton(as: ProfileRepository)
class ProfileRepositoryImpl implements ProfileRepository {
  ProfileRepositoryImpl(this._remote);

  final ProfileRemoteDataSource _remote;

  @override
  Stream<User> watchUser(String uid) => _remote.watchUser(uid);

  @override
  Future<Either<Failure, Unit>> updateProfile({
    required String uid,
    required String fullName,
    required String whatsapp,
    required String email,
    String? photoUrl,
  }) async {
    try {
      await _remote.updateProfile(
        uid: uid,
        fullName: fullName,
        whatsapp: whatsapp,
        email: email,
        photoUrl: photoUrl,
      );
      return const Right(unit);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, String>> uploadProfilePhoto({
    required String uid,
    required File file,
  }) async {
    try {
      final url = await _remote.uploadProfilePhoto(uid: uid, file: file);
      return Right(url);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure('Photo upload failed. Please try again.'));
    }
  }

  @override
  Future<Either<Failure, Unit>> deleteAccount(String uid) async {
    try {
      await _remote.anonymiseAccount(uid);
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
