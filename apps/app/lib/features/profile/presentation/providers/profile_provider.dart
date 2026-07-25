import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/usecase/usecase.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/domain/usecases/clear_fcm_token.dart';
import '../../../auth/domain/usecases/sign_out.dart';
import '../../domain/usecases/delete_account.dart';
import '../../domain/usecases/update_profile.dart';
import '../../domain/usecases/upload_profile_photo.dart';
import '../../domain/usecases/watch_user.dart';

/// The customer's own account state: the live `users/{uid}` document plus the
/// three actions that mutate it (edit, delete, log out).
///
/// WHY a second listener on `users/{uid}` when AuthProvider already mirrors it:
/// AuthProvider's copy is a routing signal (signed in? profile complete?) owned
/// by the auth session. This one is the profile screen's data, and it carries
/// the saving/deleting state that only this feature has. They read the same
/// document; only this one writes it.
///
/// WHY sign-out is delegated to the auth feature's use cases rather than
/// re-implemented: the device's FCM token must be detached BEFORE Firebase Auth
/// is torn down, or the phone keeps receiving the previous customer's pushes.
@injectable
class ProfileProvider extends ChangeNotifier {
  ProfileProvider(
    this._watchUser,
    this._updateProfile,
    this._uploadProfilePhoto,
    this._deleteAccount,
    this._signOut,
    this._clearFcmToken,
  );

  final WatchUser _watchUser;
  final UpdateProfile _updateProfile;
  final UploadProfilePhoto _uploadProfilePhoto;
  final DeleteAccount _deleteAccount;
  final SignOut _signOut;
  final ClearFcmToken _clearFcmToken;

  // --- State ----------------------------------------------------------------
  User? _user;
  String? _uid;
  bool _isLoading = true;
  bool _isSaving = false;
  bool _isDeleting = false;
  String? _error;

  StreamSubscription<User>? _sub;

  User? get user => _user;

  /// The document has not arrived yet — the screen shows its shimmer.
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  bool get isDeleting => _isDeleting;
  String? get error => _error;

  /// A non-empty `affiliateCode` IS affiliate status (see [User.isAffiliate]).
  bool get isAffiliate => _user?.isAffiliate ?? false;

  // --- Lifecycle ------------------------------------------------------------

  /// Start (or restart) mirroring `users/[uid]`. Idempotent for the same uid, so
  /// a rebuilding screen cannot open a second listener on the same document.
  void init(String uid) {
    if (uid.isEmpty) return;
    if (_uid == uid && _sub != null) return;

    _sub?.cancel();
    _uid = uid;
    _isLoading = true;
    _error = null;
    notifyListeners();

    _sub = _watchUser(uid).listen(
      (user) {
        _user = user;
        _isLoading = false;
        _error = null;
        notifyListeners();
      },
      onError: (Object _) {
        // The stream already degrades a missing document to a stub, so reaching
        // here means the read itself failed. Keep whatever we had and stop the
        // shimmer rather than trapping the screen in a loading state.
        _isLoading = false;
        _error = 'Could not load your profile.';
        notifyListeners();
      },
    );
  }

  // --- Edit -----------------------------------------------------------------

  /// Save the editable profile fields. When [photo] is given it is uploaded
  /// first and its URL written with the rest, so a failed upload never leaves a
  /// half-saved profile pointing at a missing image.
  ///
  /// Returns `null` on success, or a friendly error message.
  Future<String?> updateProfile({
    required String fullName,
    required String whatsapp,
    required String email,
    File? photo,
  }) async {
    final uid = _uid;
    if (uid == null) return 'You are not signed in.';

    _isSaving = true;
    _error = null;
    notifyListeners();

    String? photoUrl;
    if (photo != null) {
      final upload = await _uploadProfilePhoto(
        UploadProfilePhotoParams(uid: uid, file: photo),
      );
      final failed = upload.fold<String?>((f) => f.message, (url) {
        photoUrl = url;
        return null;
      });
      if (failed != null) {
        _isSaving = false;
        _error = failed;
        notifyListeners();
        return failed;
      }
    }

    final result = await _updateProfile(
      UpdateProfileParams(
        uid: uid,
        fullName: fullName,
        whatsapp: whatsapp,
        email: email,
        photoUrl: photoUrl,
      ),
    );

    _isSaving = false;
    return result.fold(
      (failure) {
        _error = failure.message;
        notifyListeners();
        return failure.message;
      },
      (_) {
        _error = null;
        notifyListeners();
        return null;
      },
    );
  }

  // --- Delete ---------------------------------------------------------------

  /// Anonymise the account (spec §2.21) and sign out. Orders and payments are
  /// deliberately left intact for accounting.
  ///
  /// Returns `null` on success, or a friendly error message.
  Future<String?> deleteAccount() async {
    final uid = _uid;
    if (uid == null) return 'You are not signed in.';

    _isDeleting = true;
    _error = null;
    notifyListeners();

    final result = await _deleteAccount(uid);
    final failure = result.fold<String?>((f) => f.message, (_) => null);

    if (failure != null) {
      _isDeleting = false;
      _error = failure;
      notifyListeners();
      return failure;
    }

    await logout();
    _isDeleting = false;
    notifyListeners();
    return null;
  }

  // --- Session --------------------------------------------------------------

  /// Detach this device's push token, then sign out.
  ///
  /// The document listener is cancelled FIRST: once Firebase Auth is gone the
  /// security rules reject the snapshot, which would surface as a spurious
  /// "could not load your profile" error on the way to the login screen.
  Future<void> logout() async {
    await _sub?.cancel();
    _sub = null;
    _uid = null;
    _user = null;
    _isLoading = true;
    _error = null;
    notifyListeners();

    await _clearFcmToken(const NoParams());
    await _signOut(const NoParams());
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
