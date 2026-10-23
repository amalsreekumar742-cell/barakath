import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/policy.dart';
import '../../domain/repositories/policy_repository.dart';
import '../datasources/policy_remote_datasource.dart';

@LazySingleton(as: PolicyRepository)
class PolicyRepositoryImpl implements PolicyRepository {
  PolicyRepositoryImpl(this._remote);

  final PolicyRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<Policy>>> getPolicies() async {
    try {
      final policies = await _remote.getEnabledPolicies();
      return Right(policies);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }

  @override
  Future<Either<Failure, Policy?>> getPolicy(String policyId) async {
    try {
      final policy = await _remote.getPolicy(policyId);
      return Right(policy);
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    } catch (_) {
      return const Left(ServerFailure());
    }
  }
}
