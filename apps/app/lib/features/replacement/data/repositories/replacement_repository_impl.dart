import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/replacement.dart';
import '../../domain/entities/replacement_draft.dart';
import '../../domain/repositories/replacement_repository.dart';
import '../datasources/replacement_remote_datasource.dart';

/// Catches the datasource's exceptions and returns `Either<Failure, T>`.
@LazySingleton(as: ReplacementRepository)
class ReplacementRepositoryImpl implements ReplacementRepository {
  ReplacementRepositoryImpl(this._remote);

  final ReplacementRemoteDataSource _remote;

  @override
  Future<Either<Failure, Replacement>> submitRequest(
    ReplacementDraft draft,
  ) async {
    try {
      return Right(await _remote.submitRequest(draft));
    } on AuthException catch (e) {
      return Left(AuthFailure(e.message));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
