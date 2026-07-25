import 'package:injectable/injectable.dart';

import '../repositories/wishlist_repository.dart';

/// Live wishlist product ids. Returns the repository stream directly (a stream
/// isn't a one-shot `Either`), emitting `[]` while signed out.
@injectable
class WatchWishlistProductIds {
  WatchWishlistProductIds(this._repository);

  final WishlistRepository _repository;

  Stream<List<String>> call() => _repository.watchWishlistProductIds();
}
