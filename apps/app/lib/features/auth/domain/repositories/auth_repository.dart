import 'dart:typed_data';

import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/user.dart';

/// Domain contract for authentication + the customer profile. Implemented in the
/// data layer; the presentation layer only ever sees `Either<Failure, T>` (and
/// the auth-state stream), never a raw exception.
abstract class AuthRepository {
  /// Live auth + profile state: emits the signed-in [User] (a stub with an empty
  /// name until the `users/{uid}` doc resolves), and `null` when signed out.
  Stream<User?> watchAuthUser();

  /// Request an OTP for [phone] (national number) under dial code [countryCode]
  /// (e.g. `+91`).
  Future<Either<Failure, Unit>> sendOtp(String phone, String countryCode);

  /// Verify [otp] for [phone] under [countryCode]. On success signs in with the
  /// returned custom token and yields whether this is a brand-new account
  /// (→ profile creation).
  Future<Either<Failure, bool>> verifyOtp(
    String phone,
    String otp,
    String countryCode,
  );

  /// Resend the OTP. [retryType] is 'text' (SMS) or 'voice' (call); [countryCode]
  /// must match the one the OTP was first sent with.
  Future<Either<Failure, Unit>> resendOtp(
    String phone,
    String retryType,
    String countryCode,
  );

  /// Persist the (optional) profile fields to `users/{uid}`, rebuilding the
  /// `keywords` search array from the name + phone.
  Future<Either<Failure, Unit>> createProfile({
    required String fullName,
    String email,
    String whatsapp,
    String friendCode,
    String? photoUrl,
  });

  /// Upload the avatar bytes to `users/{uid}/profile`; returns the download URL.
  Future<Either<Failure, String>> uploadProfilePhoto(Uint8List bytes);

  /// Register this device's FCM token on `users/{uid}` so the server can push to
  /// it. Without this the stored token stays empty and every notification the
  /// backend sends is silently dropped.
  Future<Either<Failure, Unit>> syncFcmToken();

  /// Emits a new FCM token whenever the device's registration rotates.
  Stream<String> watchFcmTokenRefresh();

  /// Detach this device's token from the signed-in user.
  Future<Either<Failure, Unit>> clearFcmToken();

  /// Sign out the current Firebase user.
  Future<Either<Failure, Unit>> signOut();
}
