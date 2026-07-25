import 'package:injectable/injectable.dart';

import '../repositories/wallet_repository.dart';

/// Live wallet balance for a uid. Returns the repository stream directly — a
/// subscription isn't a one-shot `Either` (same shape as `WatchAuthUser`).
@injectable
class WatchWalletBalance {
  WatchWalletBalance(this._repository);

  final WalletRepository _repository;

  Stream<double> call(String uid) => _repository.watchBalance(uid);
}
