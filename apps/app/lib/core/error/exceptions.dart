/// App-level exceptions thrown by the **data layer** (datasources).
///
/// Datasources throw these on failure; the repository catches them and converts
/// each into the matching [Failure] (see `failures.dart`) on the `Left` of
/// `Either`. Exceptions must never escape past the repository into domain/UI.
library;

/// A backend/remote failure (Firestore, Storage, or a rejected Cloud Function).
class ServerException implements Exception {
  const ServerException([this.message = 'Something went wrong. Please try again.', this.code]);

  final String message;
  final String? code;

  @override
  String toString() => 'ServerException($code): $message';
}

/// No usable internet connection.
class NetworkException implements Exception {
  const NetworkException([this.message = 'No internet connection.']);

  final String message;

  @override
  String toString() => 'NetworkException: $message';
}

/// A local persistence failure (SharedPreferences / on-device cache).
class CacheException implements Exception {
  const CacheException([this.message = 'Could not read local data.']);

  final String message;

  @override
  String toString() => 'CacheException: $message';
}

/// An authentication / authorization failure (not signed in, invalid OTP, ...).
class AuthException implements Exception {
  const AuthException([this.message = 'Authentication failed.', this.code]);

  final String message;
  final String? code;

  @override
  String toString() => 'AuthException($code): $message';
}
