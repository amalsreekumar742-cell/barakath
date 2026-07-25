import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Detach this device's FCM token on sign-out, so the phone stops receiving the
/// previous customer's order and offer notifications.
@injectable
class ClearFcmToken implements UseCase<Unit, NoParams> {
  ClearFcmToken(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(NoParams params) =>
      _repository.clearFcmToken();
}
