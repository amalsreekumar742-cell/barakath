import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/app_notification.dart';

/// One cursor-paginated page of notifications.
///
/// [nextCursor] is opaque (`Object?`) on purpose: it is a Firestore
/// `DocumentSnapshot` minted in — and only ever read back by — the data layer,
/// so the domain never depends on the Firestore SDK.
class NotificationPageResult {
  const NotificationPageResult({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<AppNotification> items;
  final Object? nextCursor;
  final bool hasMore;
}

/// Reading the customer's notification feed (spec §2.21, §4.18).
///
/// TWO queries, not one: the deployed document has no `customerId` — audience is
/// `targetType` ('All' | 'Specific') plus a `targetUserIds` ARRAY. Firestore
/// cannot OR an equality and an array-contains in one query, and the two
/// deployed composite indexes are exactly `(targetType, isSent, createdAt)` and
/// `(targetUserIds array-contains, createdAt)`. So the feed is a client-side
/// merge of two independently paginated streams.
abstract class NotificationRepository {
  /// Broadcasts: `targetType == 'All' && isSent == true`, newest first.
  Future<Either<Failure, NotificationPageResult>> getBroadcasts({
    required int limit,
    Object? startAfter,
  });

  /// Addressed to this customer: `targetUserIds array-contains uid`, newest
  /// first. Returns an empty page when nobody is signed in.
  Future<Either<Failure, NotificationPageResult>> getPersonal({
    required int limit,
    Object? startAfter,
  });

  // --- Read state (SharedPreferences ONLY — spec §4.18) ---------------------
  // "Read status: SharedPreferences (app) — no Firestore sub-collection." The
  // documents are shared broadcasts; a per-customer read flag has no field to
  // live in and no rule that would allow writing one.

  Future<Either<Failure, Set<String>>> getReadIds();

  Future<Either<Failure, Set<String>>> markRead(String notificationId);

  Future<Either<Failure, Set<String>>> markAllRead(Iterable<String> ids);
}
