import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';

/// Decides whether a [FirebaseException]'s own message is fit for a customer.
///
/// WHY this exists: every datasource writes
/// `e.message ?? 'Could not load your orders.'`. That reads as "prefer the real
/// error, fall back to friendly copy" — but Firestore and Storage ALWAYS
/// populate `message` with SDK diagnostics, so the fallback was unreachable and
/// the customer always got the raw text. A missing composite index renders as a
/// wall of prose ending in a
/// `console.firebase.google.com/…/firestore/indexes?create_composite=Ci9wcm9q…`
/// link — a Firebase console URL, on a customer's phone, under a Retry button.
///
/// Returning `String?` is deliberate: `null` means "I have nothing better than
/// what you already wrote", so the existing `?? 'friendly copy'` at each call
/// site keeps working and finally becomes reachable. The call sites already had
/// good copy; it was just dead.
class FirebaseErrorMessage {
  const FirebaseErrorMessage._();

  /// Customer-safe text for [e], or `null` to defer to the caller's fallback.
  static String? of(FirebaseException e) {
    // A callable's message is written by our own backend
    // (`HttpsError('failed-precondition', 'This coupon has expired')`) and is
    // deliberately customer-facing — it is more precise than any generic
    // fallback, so it wins.
    if (e is FirebaseFunctionsException) {
      final serverMessage = e.message?.trim() ?? '';
      // Callables can still surface framework text — an unhandled crash comes
      // back as INTERNAL. A URL is the tell that it isn't ours.
      if (serverMessage.isEmpty || _looksLikeSdkDiagnostic(serverMessage)) {
        return null;
      }
      return serverMessage;
    }

    // Firestore / Storage / Auth. A few codes deserve better than the caller's
    // "could not load X", because the customer can actually act on them.
    return switch (e.code) {
      'permission-denied' => 'You do not have access to this.',
      'unauthenticated' => 'Please sign in again to continue.',
      // Cloud Storage's flavour of permission-denied. Our storage.rules reject an
      // upload for exactly three reasons: wrong owner, >= 2MB, or not an image.
      // The path is always the caller's own, and the callers check the type, so
      // in practice this means SIZE — which the customer can actually act on.
      // Left generic enough to stay true if it is one of the other two.
      'unauthorized' =>
        'That file was rejected. It must be an image under 2MB.',
      'quota-exceeded' => 'Storage is temporarily full. Please try again later.',
      'retry-limit-exceeded' =>
        'The upload timed out. Please check your connection and try again.',
      'unavailable' ||
      'network-request-failed' =>
        'No internet connection. Please check your network.',
      'deadline-exceeded' => 'That took too long. Please try again.',
      'resource-exhausted' =>
        'Too many requests just now. Please try again in a moment.',
      // Everything else — including `failed-precondition`, the missing-index
      // case — defers to the caller, who knows what the customer was doing.
      _ => null,
    };
  }

  /// True when a message is SDK/console output rather than copy meant for a
  /// person. A URL is the reliable tell — none of our own strings contain one.
  static bool _looksLikeSdkDiagnostic(String message) =>
      message.contains('https://') || message.contains('http://');
}
