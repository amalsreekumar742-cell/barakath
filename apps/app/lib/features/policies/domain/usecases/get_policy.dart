import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/policy.dart';
import '../repositories/policy_repository.dart';

/// Fetch one policy by its document id. `Right(null)` when it is missing or
/// not enabled.
@injectable
class GetPolicy implements UseCase<Policy?, String> {
  GetPolicy(this._repository);

  final PolicyRepository _repository;

  @override
  Future<Either<Failure, Policy?>> call(String policyId) =>
      _repository.getPolicy(policyId);
}
