import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../domain/usecases/add_to_wishlist.dart';
import '../../domain/usecases/remove_from_wishlist.dart';
import '../../domain/usecases/watch_wishlist_product_ids.dart';

/// The customer's wishlist as a live `Set<String>` of product ids.
///
/// WHY a set of ids and not a list of products: every product card on every
/// surface asks the same question ("is this hearted?"), and a set answers it in
/// O(1) without duplicating catalogue data the screen already has.
///
/// The subscription is driven by the datasource's auth-aware stream, so sign-in
/// starts it and sign-out empties it — this provider never has to be told about
/// session changes.
@injectable
class WishlistProvider extends ChangeNotifier {
  WishlistProvider(
    this._watchWishlistProductIds,
    this._addToWishlist,
    this._removeFromWishlist,
  ) {
    _sub = _watchWishlistProductIds().listen(_onIds);
  }

  final WatchWishlistProductIds _watchWishlistProductIds;
  final AddToWishlist _addToWishlist;
  final RemoveFromWishlist _removeFromWishlist;

  StreamSubscription<List<String>>? _sub;

  final Set<String> _productIds = <String>{};

  /// Ids currently being written — the heart shows the optimistic state but
  /// must not fire a second write while the first is in flight.
  final Set<String> _pending = <String>{};

  Set<String> get productIds => Set.unmodifiable(_productIds);
  int get count => _productIds.length;

  bool isWishlisted(String productId) => _productIds.contains(productId);

  bool isPending(String productId) => _pending.contains(productId);

  void _onIds(List<String> ids) {
    _productIds
      ..clear()
      ..addAll(ids);
    notifyListeners();
  }

  /// Heart / un-heart [productId]. Returns `null` on success or a friendly error
  /// message. Callers must gate guests with the login prompt first — a guest
  /// call fails with an auth failure rather than writing.
  ///
  /// The local set is updated optimistically so the heart flips instantly; the
  /// stream confirms it a moment later, and a failure rolls it back.
  Future<String?> toggle(String productId) async {
    if (_pending.contains(productId)) return null;

    final wasWishlisted = _productIds.contains(productId);
    _pending.add(productId);
    wasWishlisted ? _productIds.remove(productId) : _productIds.add(productId);
    notifyListeners();

    final params = WishlistParams(productId);
    final result = wasWishlisted
        ? await _removeFromWishlist(params)
        : await _addToWishlist(params);

    _pending.remove(productId);
    return result.fold(
      (failure) {
        wasWishlisted
            ? _productIds.add(productId)
            : _productIds.remove(productId);
        notifyListeners();
        return failure.message;
      },
      (_) {
        notifyListeners();
        return null;
      },
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
