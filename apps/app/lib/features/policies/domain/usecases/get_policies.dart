import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/policy.dart';
import '../repositories/policy_repository.dart';

/// Fetch every enabled policy, in the admin's display order.
@injectable
class GetPolicies implements UseCase<List<Policy>, NoParams> {
  GetPolicies(this._repository);

  final PolicyRepository _repository;

  @override
  Future<Either<Failure, List<Policy>>> call(NoParams params) =>
      _repository.getPolicies();
}
