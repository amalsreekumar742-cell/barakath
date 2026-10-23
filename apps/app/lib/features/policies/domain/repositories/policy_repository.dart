import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/policy.dart';

/// Domain contract for reading customer-facing policies. Implemented in the
/// data layer.
abstract class PolicyRepository {
  /// Every enabled policy in the admin's display order (possibly empty), or a
  /// [Failure] on the `Left`.
  Future<Either<Failure, List<Policy>>> getPolicies();

  /// One policy by id. `Right(null)` means it does not exist or is not enabled
  /// — the two are indistinguishable to a customer and both render "not
  /// available"; a [Failure] is reserved for a read that genuinely failed.
  Future<Either<Failure, Policy?>> getPolicy(String policyId);
}
