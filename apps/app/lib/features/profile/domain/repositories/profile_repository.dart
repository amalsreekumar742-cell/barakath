import 'dart:io';

import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../../../auth/domain/entities/user.dart';

/// Domain contract for the customer's own account surface (spec §2.21).
///
/// WHY it reuses `features/auth`'s [User] entity rather than declaring a second
/// one: `users/{uid}` is a single document with a single shape. Two entities
/// over one document is how `displayName` vs `fullName` drift starts.
abstract class ProfileRepository {
  /// Live `users/{uid}`. Emits a stub (empty fields, real id) rather than an
  /// error when the document is missing or unreadable, so the profile screen
  /// degrades to "add your name" instead of an error page.
  Stream<User> watchUser(String uid);

  /// Merge the customer-editable profile fields and rebuild the `keywords`
  /// search array. Server-owned money/counter fields are never touched.
  Future<Either<Failure, Unit>> updateProfile({
    required String uid,
    required String fullName,
    required String whatsapp,
    required String email,
    String? photoUrl,
  });

  /// Upload the avatar to `users/{uid}/profile`; returns the download URL.
  Future<Either<Failure, String>> uploadProfilePhoto({
    required String uid,
    required File file,
  });

  /// Account deletion, spec §2.21: the document is ANONYMISED, not destroyed —
  /// orders and payments must survive for accounting.
  Future<Either<Failure, Unit>> deleteAccount(String uid);
}
