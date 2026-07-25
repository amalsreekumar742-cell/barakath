import 'dart:async';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/services/storage_service.dart';
import '../../../../core/utils/keywords.dart';
import '../../../auth/data/models/user_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place the profile feature touches Firebase.
///
/// WHY it reuses `features/auth`'s [UserModel]: this reads and writes the SAME
/// `users/{uid}` document the auth feature mirrors. A second model would be a
/// second place for a field rename to be missed.
abstract class ProfileRemoteDataSource {
  /// Live `users/{uid}`. Never errors: a missing/unreadable document emits
  /// [UserModel.empty] so the screen can render "Add your name".
  Stream<UserModel> watchUser(String uid);

  /// Write the customer-editable fields and rebuild `keywords`.
  Future<void> updateProfile({
    required String uid,
    required String fullName,
    required String whatsapp,
    required String email,
    String? photoUrl,
  });

  /// Upload to `users/{uid}/profile` (Storage), returning the download URL.
  Future<String> uploadProfilePhoto({
    required String uid,
    required File file,
  });

  /// Null out the personal fields, empty the wishlist and block the account.
  /// Orders, payments and wallet ledgers are deliberately untouched.
  Future<void> anonymiseAccount(String uid);
}

@LazySingleton(as: ProfileRemoteDataSource)
class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  ProfileRemoteDataSourceImpl(this._firestore, this._storage);

  final FirebaseFirestore _firestore;
  final StorageService _storage;

  /// Wishlist documents deleted per batch. Firestore caps a write batch at 500;
  /// staying under it leaves room for the loop to be safe on a big wishlist.
  static const int _wishlistBatchSize = 400;

  /// A hard stop on the delete loop — an unbounded `while (true)` against a
  /// network collection is how a "delete account" tap hangs forever.
  static const int _maxWishlistBatches = 10;

  DocumentReference<Map<String, dynamic>> _userDoc(String uid) =>
      _firestore.collection(FirebaseCollections.users).doc(uid);

  @override
  Stream<UserModel> watchUser(String uid) {
    return _userDoc(uid).snapshots().map(
          (doc) => doc.exists
              ? UserModel.fromFirestore(doc)
              : UserModel.empty(uid),
        );
  }

  @override
  Future<void> updateProfile({
    required String uid,
    required String fullName,
    required String whatsapp,
    required String email,
    String? photoUrl,
  }) async {
    try {
      final ref = _userDoc(uid);

      // The phone is read back from the document rather than trusted from the
      // client: it is the account identity and it feeds the admin's search
      // keywords, so a stale cached value would quietly break customer lookup.
      final snap = await ref.get();
      final phone = (snap.data()?['phone'] ?? '').toString();

      final data = <String, dynamic>{
        'fullName': fullName.trim(),
        'whatsapp': whatsapp.trim(),
        'email': email.trim(),
        'keywords': buildKeywords([fullName, phone, email]),
        'updatedAt': FieldValue.serverTimestamp(),
      };
      if (photoUrl != null && photoUrl.isNotEmpty) {
        data['profileImage'] = photoUrl;
      }

      // `update` not `set(merge:)`: the document must already exist (it is
      // created by verifyOTP), and update is the narrower operation the
      // security rules are written against.
      await ref.update(data);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not save your profile.', e.code);
    }
  }

  @override
  Future<String> uploadProfilePhoto({
    required String uid,
    required File file,
  }) async {
    try {
      // StoragePaths.profilePhoto overrides spec §4.22 on purpose — see its doc.
      return await _storage.uploadImage(file, StoragePaths.profilePhoto(uid));
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Photo upload failed.', e.code);
    }
  }

  @override
  Future<void> anonymiseAccount(String uid) async {
    final ref = _userDoc(uid);

    // Step 1 — the part that must succeed: the personal data goes first, so a
    // later failure can never leave the customer's name and email in place
    // while telling them the account is gone.
    try {
      await ref.update({
        'fullName': '',
        'email': '',
        'whatsapp': '',
        'profileImage': '',
        'fcmToken': '',
        'keywords': <String>[],
        'updatedAt': FieldValue.serverTimestamp(),
      });
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not delete your account. Please try again.',
        e.code,
      );
    }

    // Step 2 — best-effort cleanup. Both writes are already "extra": the PII is
    // gone, and failing the whole action over them would push the customer to
    // retry a delete that has effectively happened.
    await _clearWishlist(uid);

    // KNOWN GAP: firestore.rules `onlyOwnProfileFields()` whitelists
    // fullName/email/whatsapp/profileImage/referredBy/keywords/fcmToken/
    // updatedAt — `status` is NOT in it, so this write is rejected today and the
    // account is anonymised but not blocked. Left in (and swallowed) so it
    // starts working the moment the rules gain `status`, or the flip moves to a
    // Cloud Function. Reported to the caller.
    await ref
        .update({'status': 'Blocked'})
        .catchError((Object _) {});
  }

  /// Delete `users/{uid}/wishlist` in bounded batches. Never throws.
  Future<void> _clearWishlist(String uid) async {
    final collection = _userDoc(uid).collection(FirebaseCollections.wishlist);
    try {
      for (var i = 0; i < _maxWishlistBatches; i++) {
        final snap = await collection.limit(_wishlistBatchSize).get();
        if (snap.docs.isEmpty) return;

        final batch = _firestore.batch();
        for (final doc in snap.docs) {
          batch.delete(doc.reference);
        }
        await batch.commit();

        if (snap.docs.length < _wishlistBatchSize) return;
      }
    } catch (_) {
      // Best-effort: a leftover wishlist entry is not personal data worth
      // failing an account deletion over.
    }
  }
}
