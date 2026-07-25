import 'dart:typed_data';

import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

/// Catches the datasource's exceptions and returns `Either<Failure, T>` — no
/// exception ever escapes past here into the domain/presentation layers.
@LazySingleton(as: AuthRepository)
class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._remote);

  final AuthRemoteDataSource _remote;

  @override
  Stream<User?> watchAuthUser() => _remote.watchAuthUser();

  @override
  Future<Either<Failure, Unit>> sendOtp(String phone, String countryCode) async {
    try {
      await _remote.sendOtp(phone, countryCode);
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, bool>> verifyOtp(
    String phone,
    String otp,
    String countryCode,
  ) async {
    try {
      final isNewUser = await _remote.verifyOtp(phone, otp, countryCode);
      return Right(isNewUser);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> resendOtp(
    String phone,
    String retryType,
    String countryCode,
  ) async {
    try {
      await _remote.resendOtp(phone, retryType, countryCode);
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> createProfile({
    required String fullName,
    String email = '',
    String whatsapp = '',
    String friendCode = '',
    String? photoUrl,
  }) async {
    try {
      await _remote.createProfile(
        fullName: fullName,
        email: email,
        whatsapp: whatsapp,
        friendCode: friendCode,
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
  Future<Either<Failure, String>> uploadProfilePhoto(Uint8List bytes) async {
    try {
      final url = await _remote.uploadProfilePhoto(bytes);
      return Right(url);
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> signOut() async {
    try {
      await _remote.signOut();
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Unit>> syncFcmToken() async {
    try {
      await _remote.syncFcmToken();
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Stream<String> watchFcmTokenRefresh() => _remote.watchFcmTokenRefresh();

  @override
  Future<Either<Failure, Unit>> clearFcmToken() async {
    try {
      await _remote.clearFcmToken();
      return const Right(unit);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
