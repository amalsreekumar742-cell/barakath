import 'package:injectable/injectable.dart';

import '../entities/user.dart';
import '../repositories/auth_repository.dart';

/// Live auth + profile state. Returns the repository stream directly (a stream
/// isn't a one-shot `Either`), emitting the signed-in [User] or `null`.
@injectable
class WatchAuthUser {
  WatchAuthUser(this._repository);

  final AuthRepository _repository;

  Stream<User?> call() => _repository.watchAuthUser();
}
