import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

/// Register this device's FCM token against the signed-in customer so the
/// backend's `sendFCMToUser` has somewhere to push. Runs on every sign-in — the
/// token can change between sessions (reinstall, restore, app-data clear).
@injectable
class SyncFcmToken implements UseCase<Unit, NoParams> {
  SyncFcmToken(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(NoParams params) =>
      _repository.syncFcmToken();
}
