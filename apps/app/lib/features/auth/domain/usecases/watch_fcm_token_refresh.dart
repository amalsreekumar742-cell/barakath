import 'package:injectable/injectable.dart';

import '../repositories/auth_repository.dart';

/// Emits a new FCM token whenever the device's registration rotates. Not a
/// [UseCase] because it returns a stream, matching [WatchAuthUser]'s shape.
@injectable
class WatchFcmTokenRefresh {
  WatchFcmTokenRefresh(this._repository);

  final AuthRepository _repository;

  Stream<String> call() => _repository.watchFcmTokenRefresh();
}
