import 'package:equatable/equatable.dart';

/// Base type for every recoverable error that reaches the presentation layer.
///
/// Repositories convert caught [Exception]s (see `exceptions.dart`) into a
/// [Failure] and return it on the `Left` side of `Either<Failure, T>`, so the
/// UI never sees a raw exception — it pattern-matches on a `Failure` subtype and
/// shows [message]. Keep subtypes coarse (server / network / cache / auth);
/// carry detail in [message].
abstract class Failure extends Equatable {
  const Failure(this.message);

  /// A user-safe, already-friendly message to surface in the UI.
  final String message;

  @override
  List<Object?> get props => [message];
}

/// A backend/remote error — a failed Firestore/Storage write, a rejected Cloud
/// Function call, or any server-reported problem.
class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Something went wrong. Please try again.']);
}

/// No usable internet connection.
class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'No internet connection. Please check your network.']);
}

/// A local persistence error (SharedPreferences / on-device cache).
class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Could not read local data.']);
}

/// An authentication / authorization error (not signed in, invalid OTP, etc.).
class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Authentication failed. Please try again.']);
}
