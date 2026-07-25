import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../../core/utils/constants.dart';
import '../../domain/entities/app_notification.dart';
import '../../domain/repositories/notification_repository.dart';
import '../../domain/usecases/get_broadcast_notifications.dart';
import '../../domain/usecases/get_personal_notifications.dart';
import '../../domain/usecases/get_read_notification_ids.dart';
import '../../domain/usecases/mark_all_notifications_read.dart';
import '../../domain/usecases/mark_notification_read.dart';

/// The notification feed: two merged Firestore streams plus local read state
/// (spec §2.21 Notifications, §4.18).
///
/// WHY two lists and two cursors instead of one: the deployed document has no
/// `customerId`, so the audience is `targetType == 'All'` OR
/// `targetUserIds array-contains uid` — Firestore cannot OR those in one query.
/// Each stream paginates independently and [notifications] is the merged,
/// newest-first view of whatever has been loaded from both.
@injectable
class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider(
    this._getBroadcasts,
    this._getPersonal,
    this._getReadIds,
    this._markRead,
    this._markAllRead,
  );

  final GetBroadcastNotifications _getBroadcasts;
  final GetPersonalNotifications _getPersonal;
  final GetReadNotificationIds _getReadIds;
  final MarkNotificationRead _markRead;
  final MarkAllNotificationsRead _markAllRead;

  /// Two-line tiles with a small leading icon — the medium/balanced page size.
  static const int _pageSize = PageSizes.defaultPageSize;

  // --- State ---------------------------------------------------------------
  final List<AppNotification> _broadcasts = [];
  final List<AppNotification> _personal = [];
  List<AppNotification> _merged = const [];

  Object? _broadcastCursor;
  Object? _personalCursor;
  bool _broadcastHasMore = true;
  bool _personalHasMore = true;

  Set<String> _readIds = <String>{};

  bool _isLoading = false;
  bool _isLoadingMore = false;
  String? _error;

  /// Newest-first across both streams.
  List<AppNotification> get notifications => List.unmodifiable(_merged);

  Set<String> get readIds => Set.unmodifiable(_readIds);

  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  String? get error => _error;

  /// True while either stream may still yield older documents.
  bool get hasMore => _broadcastHasMore || _personalHasMore;

  bool isRead(String notificationId) => _readIds.contains(notificationId);

  /// Exposed so the Profile screen can badge its Notifications row. Counts only
  /// what has been LOADED — read state is a local id list, so there is nothing
  /// to count against documents this device has never seen.
  int get unreadCount =>
      _merged.where((n) => !_readIds.contains(n.id)).length;

  bool get hasUnread => unreadCount > 0;

  // --- Load ----------------------------------------------------------------

  /// First page of both streams plus the stored read ids.
  Future<void> load() async {
    if (_isLoading) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    _broadcasts.clear();
    _personal.clear();
    _broadcastCursor = null;
    _personalCursor = null;
    _broadcastHasMore = true;
    _personalHasMore = true;

    // The read ids come from SharedPreferences and cannot fail in a way worth
    // blocking the list for — a cache miss just renders everything unread.
    final readResult = await _getReadIds(const NoParams());
    _readIds = readResult.getOrElse(() => <String>{});

    final results = await Future.wait([
      _getBroadcasts(const NotificationPageParams(limit: _pageSize)),
      _getPersonal(const NotificationPageParams(limit: _pageSize)),
    ]);

    _absorb(results[0], isBroadcast: true);
    _absorb(results[1], isBroadcast: false);

    _rebuildMerged();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> refresh() => load();

  /// Next page of every stream that still has one.
  ///
  /// WHY both at once rather than "whichever is older": the merged list is
  /// ordered by `createdAt`, so advancing only one stream would leave a window
  /// where a newer document from the other appears *below* older ones. Pulling
  /// both keeps the two watermarks close together.
  Future<void> loadMore() async {
    if (_isLoading || _isLoadingMore || !hasMore) return;
    _isLoadingMore = true;
    _error = null;
    notifyListeners();

    if (_broadcastHasMore) {
      _absorb(
        await _getBroadcasts(
          NotificationPageParams(limit: _pageSize, startAfter: _broadcastCursor),
        ),
        isBroadcast: true,
      );
    }
    if (_personalHasMore) {
      _absorb(
        await _getPersonal(
          NotificationPageParams(limit: _pageSize, startAfter: _personalCursor),
        ),
        isBroadcast: false,
      );
    }

    _rebuildMerged();
    _isLoadingMore = false;
    notifyListeners();
  }

  /// Folds one page result into the matching stream's state.
  void _absorb(
    Either<Failure, NotificationPageResult> result, {
    required bool isBroadcast,
  }) {
    result.fold(
      (failure) {
        // Keep whatever the other stream returned; surface the message only if
        // nothing at all has loaded, so one empty stream can't blank the list.
        _error ??= failure.message;
        if (isBroadcast) {
          _broadcastHasMore = false;
        } else {
          _personalHasMore = false;
        }
      },
      (page) {
        if (isBroadcast) {
          _broadcasts.addAll(page.items);
          _broadcastCursor = page.nextCursor;
          _broadcastHasMore = page.hasMore;
        } else {
          _personal.addAll(page.items);
          _personalCursor = page.nextCursor;
          _personalHasMore = page.hasMore;
        }
      },
    );
  }

  /// Merge + de-duplicate + sort newest-first. Documents without a `createdAt`
  /// (a write still settling its server timestamp) sort last rather than
  /// jumping to the top.
  void _rebuildMerged() {
    final byId = <String, AppNotification>{};
    for (final n in [..._broadcasts, ..._personal]) {
      byId[n.id] = n;
    }

    final merged = byId.values.toList()
      ..sort((a, b) {
        final left = a.createdAt;
        final right = b.createdAt;
        if (left == null && right == null) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return right.compareTo(left);
      });

    _merged = List.unmodifiable(merged);
  }

  // --- Read state ----------------------------------------------------------

  Future<void> markRead(String notificationId) async {
    if (notificationId.isEmpty || _readIds.contains(notificationId)) return;

    // Optimistic: the dot disappearing must not wait on a disk write.
    _readIds = {..._readIds, notificationId};
    notifyListeners();

    final result = await _markRead(MarkReadParams(notificationId));
    result.fold((_) {}, (ids) => _readIds = ids);
    notifyListeners();
  }

  /// "Mark all read" over everything currently loaded.
  Future<void> markAllRead() async {
    if (!hasUnread) return;

    final ids = _merged.map((n) => n.id).toList(growable: false);
    _readIds = {..._readIds, ...ids};
    notifyListeners();

    final result = await _markAllRead(MarkAllReadParams(ids));
    result.fold((_) {}, (stored) => _readIds = stored);
    notifyListeners();
  }
}
