import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place that touches Firebase for the wishlist. Documents live at
/// `users/{uid}/wishlist/{productId}` with `{productId, addedAt}` — the product
/// id doubles as the document id so a toggle is a single set/delete with no
/// lookup, and duplicates are impossible.
abstract class WishlistRemoteDataSource {
  /// Live product ids for the signed-in customer; `[]` while signed out.
  Stream<List<String>> watchWishlistProductIds();

  /// Throws [AuthException] when signed out — guests must be sent to login.
  Future<void> addToWishlist(String productId);

  Future<void> removeFromWishlist(String productId);

  Future<bool> isWishlisted(String productId);
}

@LazySingleton(as: WishlistRemoteDataSource)
class WishlistRemoteDataSourceImpl implements WishlistRemoteDataSource {
  WishlistRemoteDataSourceImpl(this._auth, this._firestore);

  final fb_auth.FirebaseAuth _auth;
  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> _wishlist(String uid) => _firestore
      .collection(FirebaseCollections.users)
      .doc(uid)
      .collection(FirebaseCollections.wishlist);

  /// The current uid, or a thrown [AuthException] — every write needs one and
  /// the security rules reject the request anyway, so failing here gives the UI
  /// a friendly message instead of a raw permission error.
  String get _requireUid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) throw const AuthException('Please log in to use your wishlist.');
    return uid;
  }

  @override
  Stream<List<String>> watchWishlistProductIds() {
    // Same switch-map wiring as the auth datasource: each auth event cancels the
    // previous collection subscription. WHY it's driven by authStateChanges and
    // not by the provider — a sign-out must stop the listener *before* the rules
    // start rejecting it, and it must emit `[]` so stale hearts can't survive
    // into the next customer's session.
    late final StreamController<List<String>> controller;
    StreamSubscription<fb_auth.User?>? authSub;
    StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? listSub;

    void onAuth(fb_auth.User? user) {
      listSub?.cancel();
      listSub = null;
      if (user == null) {
        controller.add(const []);
        return;
      }
      listSub = _wishlist(user.uid).snapshots().listen(
            (snap) => controller.add(snap.docs.map((d) => d.id).toList()),
            // A read error must not leave stale hearts lit.
            onError: (_) => controller.add(const []),
          );
    }

    controller = StreamController<List<String>>(
      onListen: () => authSub = _auth.authStateChanges().listen(onAuth),
      onCancel: () async {
        await listSub?.cancel();
        await authSub?.cancel();
      },
    );
    return controller.stream;
  }

  @override
  Future<void> addToWishlist(String productId) async {
    final uid = _requireUid;
    try {
      await _wishlist(uid).doc(productId).set({
        'productId': productId,
        'addedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not update your wishlist.',
        e.code,
      );
    }
  }

  @override
  Future<void> removeFromWishlist(String productId) async {
    final uid = _requireUid;
    try {
      await _wishlist(uid).doc(productId).delete();
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not update your wishlist.',
        e.code,
      );
    }
  }

  @override
  Future<bool> isWishlisted(String productId) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return false; // guests have no wishlist — not an error
    try {
      final doc = await _wishlist(uid).doc(productId).get();
      return doc.exists;
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not read your wishlist.',
        e.code,
      );
    }
  }
}
