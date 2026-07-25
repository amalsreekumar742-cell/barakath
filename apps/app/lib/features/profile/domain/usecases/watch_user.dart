import 'package:injectable/injectable.dart';

import '../../../auth/domain/entities/user.dart';
import '../repositories/profile_repository.dart';

/// Live `users/{uid}` for the profile surface. Returns the repository stream
/// directly — a stream is not a one-shot `Either`, so there is nothing to fold.
@injectable
class WatchUser {
  WatchUser(this._repository);

  final ProfileRepository _repository;

  Stream<User> call(String uid) => _repository.watchUser(uid);
}
