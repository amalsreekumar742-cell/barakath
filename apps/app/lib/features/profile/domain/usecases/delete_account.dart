import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/profile_repository.dart';

/// Delete (= anonymise) the signed-in customer's account, spec §2.21.
///
/// WHY not a hard delete: orders, payments and the invoice trail reference the
/// user document, and a store cannot destroy its own accounting records. The
/// spec's wording is "data anonymized (null fields)" — personal data goes, the
/// financial history stays.
@injectable
class DeleteAccount implements UseCase<Unit, String> {
  DeleteAccount(this._repository);

  final ProfileRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(String uid) =>
      _repository.deleteAccount(uid);
}
