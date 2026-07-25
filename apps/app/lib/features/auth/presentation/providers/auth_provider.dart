import 'dart:async';

import 'dart:typed_data';

import 'package:flutter/widgets.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/di/injection_container.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../notifications/data/services/push_service.dart';
import '../../domain/entities/user.dart';
import '../../domain/usecases/clear_fcm_token.dart';
import '../../domain/usecases/create_profile.dart';
import '../../domain/usecases/sync_fcm_token.dart';
import '../../domain/usecases/watch_fcm_token_refresh.dart';
import '../../domain/usecases/resend_otp.dart';
import '../../domain/usecases/send_otp.dart';
import '../../domain/usecases/sign_out.dart';
import '../../domain/usecases/upload_profile_photo.dart';
import '../../domain/usecases/verify_otp.dart';
import '../../domain/usecases/watch_auth_user.dart';

/// Outcome of an OTP verification: the OTP page needs BOTH whether it succeeded
/// and (on success) whether this is a brand-new account (→ profile creation).
class VerifyResult {
  const VerifyResult._({required this.success, this.isNewUser = false, this.error});

  const VerifyResult.success({required bool isNewUser})
      : this._(success: true, isNewUser: isNewUser);

  const VerifyResult.failure(String message)
      : this._(success: false, error: message);

  final bool success;
  final bool isNewUser;
  final String? error;
}

/// AuthProvider — the single source of truth for the customer's auth + profile
/// state. Subscribes to the auth-state stream (via [WatchAuthUser]) and mirrors
/// the signed-in user's `users/{uid}` document live; exposes plain flags the UI
/// reads. Screens call these methods and never touch Firebase directly.
@injectable
class AuthProvider extends ChangeNotifier {
  AuthProvider(
    this._sendOtp,
    this._verifyOtp,
    this._resendOtp,
    this._createProfile,
    this._signOut,
    this._uploadProfilePhoto,
    this._watchAuthUser,
    this._syncFcmToken,
    this._watchFcmTokenRefresh,
    this._clearFcmToken,
  ) {
    _authSub = _watchAuthUser().listen(_onUser);
    // A rotated token is worthless until it's written back — without this,
    // pushes stop arriving the first time FCM re-registers the device.
    _fcmSub = _watchFcmTokenRefresh().listen((_) {
      if (_currentUser != null) _syncFcmToken(const NoParams());
    });
  }

  final SendOtp _sendOtp;
  final VerifyOtp _verifyOtp;
  final ResendOtp _resendOtp;
  final CreateProfile _createProfile;
  final SignOut _signOut;
  final UploadProfilePhoto _uploadProfilePhoto;
  final WatchAuthUser _watchAuthUser;
  final SyncFcmToken _syncFcmToken;
  final WatchFcmTokenRefresh _watchFcmTokenRefresh;
  final ClearFcmToken _clearFcmToken;

  // --- State ---------------------------------------------------------------
  User? _currentUser;
  bool _isLoading = true; // initial auth resolution in flight
  bool _isGuest = false;
  bool _profileSetupSkipped = false;

  StreamSubscription<User?>? _authSub;
  StreamSubscription<String>? _fcmSub;

  /// The uid whose device token we've already registered this session — stops a
  /// Firestore write on every profile-doc snapshot.
  String? _fcmSyncedUid;

  // --- Getters -------------------------------------------------------------
  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isGuest => _isGuest;

  /// Signed in with a real Firebase account (not a guest). The stream only ever
  /// yields a non-null user for a real Firebase session, so this is exact.
  bool get isAuthenticated => _currentUser != null;

  /// A signed-in user who has filled in at least their display name.
  bool get isProfileComplete =>
      _currentUser != null && _currentUser!.isProfileComplete;

  /// The customer chose "Skip" on profile creation this session. The design
  /// offers that ("you can skip and do this later"), so the router guard must
  /// stop herding them back — it resets on sign-out and on a fresh launch.
  bool get profileSetupSkipped => _profileSetupSkipped;

  void skipProfileSetup() {
    _profileSetupSkipped = true;
    notifyListeners();
  }

  // --- Auth stream wiring ---------------------------------------------------
  void _onUser(User? user) {
    _currentUser = user;
    if (user != null) {
      _isGuest = false;
      // Register this device for push the first time we see each uid. The
      // backend's sendFCMToUser reads users/{uid}.fcmToken, so until this runs
      // every notification it sends is dropped on the floor.
      if (_fcmSyncedUid != user.id) {
        _fcmSyncedUid = user.id;
        _syncFcmToken(const NoParams());
        // Spec §2.25: the OS permission prompt is shown only once the customer
        // has an account — never at app start. This also starts foreground
        // display and deep-link handling. `SyncFcmToken` above still owns the
        // token write; this call is idempotent and writes the same value.
        //
        // Deferred to after a frame, NOT called inline: this provider is built
        // in main() before runApp(), so on a warm start the auth stream emits
        // while the Android Activity is not yet attached to the engine, and
        // `requestPermission()` fails with "getSystemService on a null object
        // reference" — the prompt then never appears at all. It failed silently
        // because the service catches and logs.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          unawaited(sl<PushService>().requestPermissionAfterLogin());
        });
      }
    } else {
      _profileSetupSkipped = false; // signed out — the next customer starts clean
      _fcmSyncedUid = null;
    }
    _isLoading = false;
    notifyListeners();
  }

  // --- OTP flow -------------------------------------------------------------

  /// Request an OTP for [phone] under dial code [countryCode] (e.g. `+91`).
  /// Returns `null` on success, or a friendly error message to surface.
  Future<String?> sendOTP(String phone, String countryCode) async {
    final result = await _sendOtp(SendOtpParams(phone, countryCode));
    return result.fold((f) => f.message, (_) => null);
  }

  /// Verify [otp] for [phone] (sent under [countryCode]). On success signs in
  /// and reports `isNewUser`.
  Future<VerifyResult> verifyOTP(
    String phone,
    String otp,
    String countryCode,
  ) async {
    final result = await _verifyOtp(
      VerifyOtpParams(phone: phone, otp: otp, countryCode: countryCode),
    );
    final failure = result.fold<Failure?>((f) => f, (_) => null);
    if (failure != null) return VerifyResult.failure(failure.message);

    // WHY wait: signInWithCustomToken resolving is NOT the same as this provider
    // being signed in — the auth stream only yields a User once users/{uid} has
    // loaded, a beat later. Returning before that lets the OTP page navigate
    // while isAuthenticated is still false, and the router guard bounces the
    // freshly signed-in customer straight back to /login.
    await _waitUntil(() => _currentUser != null);
    return VerifyResult.success(isNewUser: result.getOrElse(() => false));
  }

  /// Resolve once [ready] holds — i.e. once the live `users/{uid}` mirror has
  /// caught up with a write we just made. Times out rather than hanging, so a
  /// stalled snapshot can never wedge a screen behind a spinner.
  Future<void> _waitUntil(
    bool Function() ready, {
    Duration timeout = const Duration(seconds: 8),
  }) async {
    if (ready()) return;
    final settled = Completer<void>();
    void onChange() {
      if (ready() && !settled.isCompleted) settled.complete();
    }

    addListener(onChange);
    try {
      await settled.future.timeout(timeout, onTimeout: () {});
    } finally {
      removeListener(onChange);
    }
  }

  /// Resend the OTP. [retryType] is 'text' or 'voice'; [countryCode] must match
  /// the one the OTP was first sent with. Returns `null` on success or a friendly
  /// error message.
  Future<String?> resendOTP(
    String phone,
    String retryType,
    String countryCode,
  ) async {
    final result = await _resendOtp(
      ResendOtpParams(
        phone: phone,
        retryType: retryType,
        countryCode: countryCode,
      ),
    );
    return result.fold((f) => f.message, (_) => null);
  }

  // --- Profile --------------------------------------------------------------

  /// Upload the avatar bytes; returns the download URL, or `null` on failure.
  Future<String?> uploadProfilePhoto(Uint8List bytes) async {
    final result = await _uploadProfilePhoto(UploadProfilePhotoParams(bytes));
    return result.fold((_) => null, (url) => url);
  }

  /// Persist the (optional) profile fields. Returns `null` on success or a
  /// friendly error message.
  Future<String?> createProfile({
    required String fullName,
    String email = '',
    String whatsapp = '',
    String friendCode = '',
    String? photoUrl,
  }) async {
    final result = await _createProfile(
      CreateProfileParams(
        fullName: fullName,
        email: email,
        whatsapp: whatsapp,
        friendCode: friendCode,
        photoUrl: photoUrl,
      ),
    );
    final failure = result.fold<Failure?>((f) => f, (_) => null);
    if (failure != null) return failure.message;

    // Same reason as verifyOTP: the write succeeding isn't the same as this
    // provider seeing it. Navigating to /home before the mirrored doc carries
    // the new name leaves isProfileComplete false and the guard sends the
    // customer right back to the form they just submitted.
    await _waitUntil(() => isProfileComplete);
    return null;
  }

  // --- Session --------------------------------------------------------------

  /// Enter guest mode — browse without an account. Guarded actions still prompt
  /// for login.
  void enterGuestMode() {
    _isGuest = true;
    notifyListeners();
  }

  Future<void> signOut() async {
    _isGuest = false;
    // Detach the device token FIRST — once Firebase Auth is gone the rules no
    // longer let us write the doc, and the phone would keep receiving the
    // previous customer's notifications.
    await _clearFcmToken(const NoParams());
    await _signOut(const NoParams());
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _fcmSub?.cancel();
    super.dispose();
  }
}
