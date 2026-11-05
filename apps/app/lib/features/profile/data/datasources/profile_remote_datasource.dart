import 'dart:async';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/cloud_functions.dart';
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

  /// Permanently delete the signed-in customer's account, server-side.
  Future<void> deleteAccount();
}

@LazySingleton(as: ProfileRemoteDataSource)
class ProfileRemoteDataSourceImpl implements ProfileRemoteDataSource {
  ProfileRemoteDataSourceImpl(this._firestore, this._storage, this._functions);

  final FirebaseFirestore _firestore;
  final StorageService _storage;
  final FirebaseFunctions _functions;

  DocumentReference<Map<String, dynamic>> _userDoc(String uid) =>
      _firestore.collection(FirebaseCollections.users).doc(uid);

  @override
  Stream<UserModel> watchUser(String uid) {
    return _userDoc(uid).snapshots().map(
          (doc) =>
              doc.exists ? UserModel.fromFirestore(doc) : UserModel.empty(uid),
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
      throw ServerException(
          FirebaseErrorMessage.of(e) ?? 'Could not save your profile.', e.code);
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
      throw ServerException(
          FirebaseErrorMessage.of(e) ?? 'Photo upload failed.', e.code);
    }
  }

  @override
  Future<void> deleteAccount() async {
    try {
      await _functions.httpsCallable(CloudFunctions.deleteMyAccount).call();
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(
        // `failed-precondition` carries the customer-facing reason it was
        // refused: an order, return or withdrawal is still in progress.
        e.code == 'failed-precondition' && e.message != null
            ? e.message!
            : FirebaseErrorMessage.of(e) ??
                'Could not delete your account. Please try again.',
        e.code,
      );
    }
  }
}
