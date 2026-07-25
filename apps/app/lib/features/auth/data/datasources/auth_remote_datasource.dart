import 'dart:async';
import 'dart:typed_data';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/cloud_functions.dart';
import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/model_parse.dart';
import '../models/user_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place that touches FirebaseAuth / Firestore / Storage / Functions for
/// auth. Throws [ServerException] / [AuthException]; the repository converts those
/// into `Failure`s. (skill: Firebase lives in datasources only.)
abstract class AuthRemoteDataSource {
  /// Live auth + profile: emits the signed-in [UserModel] (a stub with an empty
  /// name until `users/{uid}` resolves) and `null` when signed out.
  Stream<UserModel?> watchAuthUser();

  /// MSG91 `authOTP` callable. [countryCode] is the dial code (e.g. `+91`).
  /// Throws [ServerException] on failure.
  Future<void> sendOtp(String phone, String countryCode);

  /// MSG91 `verifyOTP` callable. On `verified == true` signs in with the returned
  /// custom token and returns `isNewUser`. Throws [ServerException] otherwise.
  Future<bool> verifyOtp(String phone, String otp, String countryCode);

  /// MSG91 `resendOTP` callable. [retryType] is 'text' or 'voice'.
  Future<void> resendOtp(String phone, String retryType, String countryCode);

  /// Merge the optional profile fields into `users/{uid}`, rebuilding `keywords`.
  Future<void> createProfile({
    required String fullName,
    String email,
    String whatsapp,
    String friendCode,
    String? photoUrl,
  });

  /// Upload avatar bytes to `users/{uid}/profile`; returns the download URL.
  Future<String> uploadProfilePhoto(Uint8List bytes);

  /// Fetch this device's FCM registration token and store it on `users/{uid}`
  /// so the server can push to it. No-op when signed out.
  Future<void> syncFcmToken();

  /// Fires whenever FCM rotates this device's token (reinstall, restore, refresh)
  /// — the stored token must be rewritten or pushes silently stop arriving.
  Stream<String> watchFcmTokenRefresh();

  /// Detach this device's token from the user doc, so a signed-out phone stops
  /// receiving the previous customer's notifications.
  Future<void> clearFcmToken();

  Future<void> signOut();
}

@LazySingleton(as: AuthRemoteDataSource)
class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  AuthRemoteDataSourceImpl(
    this._auth,
    this._firestore,
    this._storage,
    this._functions,
    this._messaging,
  );

  final fb_auth.FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final FirebaseStorage _storage;
  final FirebaseFunctions _functions;
  final FirebaseMessaging _messaging;

  DocumentReference<Map<String, dynamic>> _userDoc(String uid) =>
      _firestore.collection(FirebaseCollections.users).doc(uid);

  // --- Auth stream ----------------------------------------------------------

  @override
  Stream<UserModel?> watchAuthUser() {
    // Combine authStateChanges with users/{uid} snapshots (switch-map semantics):
    // each new auth event cancels the previous doc subscription. No rxdart, so
    // the wiring is manual via a controller.
    late final StreamController<UserModel?> controller;
    StreamSubscription<fb_auth.User?>? authSub;
    StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? docSub;

    void onAuth(fb_auth.User? user) {
      docSub?.cancel();
      docSub = null;
      if (user == null) {
        controller.add(null);
        return;
      }
      docSub = _userDoc(user.uid).snapshots().listen(
        (doc) => controller.add(
          doc.exists ? UserModel.fromFirestore(doc) : UserModel.empty(user.uid),
        ),
        // A doc read error must not drop the user to "signed out" — keep them
        // authenticated with a stub so routing stays correct.
        onError: (_) => controller.add(UserModel.empty(user.uid)),
      );
    }

    controller = StreamController<UserModel?>(
      onListen: () => authSub = _auth.authStateChanges().listen(onAuth),
      onCancel: () async {
        await docSub?.cancel();
        await authSub?.cancel();
      },
    );
    return controller.stream;
  }

  // --- OTP (MSG91 callables) ------------------------------------------------

  @override
  Future<void> sendOtp(String phone, String countryCode) async {
    try {
      final res = await _functions.httpsCallable(CloudFunctions.authOTP).call(
        {'phone': phone, 'countryCode': countryCode},
      );
      _throwIfUnsuccessful(res.data, 'Could not send OTP. Please try again.');
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not send OTP. Please try again.',
        e.code,
      );
    }
  }

  @override
  Future<bool> verifyOtp(String phone, String otp, String countryCode) async {
    try {
      final res = await _functions.httpsCallable(CloudFunctions.verifyOTP).call(
        {'phone': phone, 'countryCode': countryCode, 'otp': otp},
      );
      final data = ModelParse.map(res.data);
      if (data['verified'] != true) {
        throw const ServerException('Invalid or expired OTP. Please try again.');
      }
      final customToken = ModelParse.toStr(data['customToken']);
      if (customToken.isEmpty) {
        throw const ServerException(
          'Something went wrong signing you in. Please try again.',
        );
      }
      await _auth.signInWithCustomToken(customToken);
      return data['isNewUser'] == true;
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not verify OTP. Please try again.',
        e.code,
      );
    } on fb_auth.FirebaseAuthException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Something went wrong signing you in. Please try again.',
        e.code,
      );
    }
  }

  @override
  Future<void> resendOtp(
    String phone,
    String retryType,
    String countryCode,
  ) async {
    try {
      final res = await _functions.httpsCallable(CloudFunctions.resendOTP).call(
        {'phone': phone, 'countryCode': countryCode, 'retryType': retryType},
      );
      _throwIfUnsuccessful(res.data, 'Could not resend OTP. Please try again.');
    } on FirebaseFunctionsException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not resend OTP. Please try again.',
        e.code,
      );
    }
  }

  /// The callables signal failure with `success == false` + a `message`.
  void _throwIfUnsuccessful(dynamic data, String fallback) {
    final map = ModelParse.map(data);
    if (map['success'] == false) {
      throw ServerException(ModelParse.toStr(map['message'], fallback));
    }
  }

  // --- Profile --------------------------------------------------------------

  @override
  Future<void> createProfile({
    required String fullName,
    String email = '',
    String whatsapp = '',
    String friendCode = '',
    String? photoUrl,
  }) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw const AuthException('You are not signed in.');
    }
    try {
      final ref = _userDoc(uid);
      final snap = await ref.get();
      final phone = ModelParse.toStr(snap.data()?['phone']);

      final data = <String, dynamic>{
        'updatedAt': FieldValue.serverTimestamp(),
        'keywords': _buildKeywords(fullName, phone),
      };
      if (fullName.trim().isNotEmpty) data['fullName'] = fullName.trim();
      if (email.trim().isNotEmpty) data['email'] = email.trim();
      if (whatsapp.trim().isNotEmpty) data['whatsapp'] = whatsapp.trim();
      if (friendCode.trim().isNotEmpty) data['referredBy'] = friendCode.trim();
      if (photoUrl != null && photoUrl.isNotEmpty) {
        data['profileImage'] = photoUrl;
      }

      await ref.set(data, SetOptions(merge: true));
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not save your profile.', e.code);
    }
  }

  /// Lowercase search tokens: whole name, each name word with prefix ladders, and
  /// the phone number. Mirrors the keyword pattern used elsewhere so admin search
  /// matches customers by name or phone.
  List<String> _buildKeywords(String fullName, String phone) {
    final set = <String>{};
    final name = fullName.trim().toLowerCase();
    if (name.isNotEmpty) {
      set.add(name);
      for (final word in name.split(RegExp(r'\s+'))) {
        if (word.isEmpty) continue;
        for (var i = 1; i <= word.length; i++) {
          set.add(word.substring(0, i));
        }
      }
    }
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.isNotEmpty) {
      set.add(digits);
      final last10 =
          digits.length > 10 ? digits.substring(digits.length - 10) : digits;
      set.add(last10);
    }
    return set.toList();
  }

  @override
  Future<String> uploadProfilePhoto(Uint8List bytes) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw const AuthException('You are not signed in.');
    }
    try {
      final ref = _storage.ref('users/$uid/profile');
      await ref.putData(bytes, SettableMetadata(contentType: 'image/jpeg'));
      return await ref.getDownloadURL();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Photo upload failed.', e.code);
    }
  }

  // --- Session --------------------------------------------------------------

  @override
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } on fb_auth.FirebaseAuthException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not sign out.', e.code);
    }
  }

  // --- Push registration ----------------------------------------------------

  @override
  Future<void> syncFcmToken() async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return; // signed out — nothing to attach the token to
    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) return; // no Play Services / not granted
      await _writeFcmToken(uid, token);
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not register this device for notifications.',
        e.code,
      );
    }
  }

  @override
  Stream<String> watchFcmTokenRefresh() => _messaging.onTokenRefresh;

  @override
  Future<void> clearFcmToken() async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;
    // Order matters: blank the stored token BEFORE deleting the local one, so a
    // failure here can't leave the server pushing to a device that no longer
    // belongs to this customer.
    await _writeFcmToken(uid, '');
    await _messaging.deleteToken().catchError((_) {});
  }

  /// WHY `update` and not `set(merge:)`: the security rules only let a customer
  /// touch a whitelist of their own profile fields, and an update on a doc that
  /// must already exist is the narrower operation. Push is best-effort, so a
  /// failure here is swallowed rather than blocking sign-in.
  Future<void> _writeFcmToken(String uid, String token) =>
      _userDoc(uid).update({
        'fcmToken': token,
        'updatedAt': FieldValue.serverTimestamp(),
      }).catchError((_) {});
}
