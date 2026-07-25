import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/error/exceptions.dart';

/// Read status lives in SharedPreferences and NOWHERE else (spec §4.18: "Read
/// status: SharedPreferences (app) / localStorage (website) — no Firestore
/// sub-collection").
///
/// WHY it can't be a Firestore field: a broadcast is ONE document shared by
/// every customer. Flipping a `read` flag on it would mark it read for the whole
/// store — and the rules correctly deny a customer any write to `notifications`.
abstract class NotificationLocalDataSource {
  Set<String> getReadIds();

  /// Returns the full set after the write, so the caller never has to re-read.
  Future<Set<String>> markRead(String notificationId);

  Future<Set<String>> markAllRead(Iterable<String> ids);
}

@LazySingleton(as: NotificationLocalDataSource)
class NotificationLocalDataSourceImpl implements NotificationLocalDataSource {
  NotificationLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  /// The key named in the Batch-4 brief. Kept here rather than in
  /// `core/utils/constants.dart` (`PrefKeys`) only because this session may not
  /// edit `lib/core/` — it belongs in `PrefKeys` alongside the cart and
  /// recent-search keys.
  static const String readIdsKey = 'read_notification_ids';

  /// Bounded so a long-lived install can't grow the entry without limit. The
  /// list is newest-first, so trimming drops the oldest ids — those documents
  /// have long since fallen off the paginated feed anyway.
  static const int _maxStoredIds = 500;

  @override
  Set<String> getReadIds() =>
      (_prefs.getStringList(readIdsKey) ?? const <String>[]).toSet();

  @override
  Future<Set<String>> markRead(String notificationId) =>
      markAllRead([notificationId]);

  @override
  Future<Set<String>> markAllRead(Iterable<String> ids) async {
    try {
      // Newly-read ids go to the front so the trim below evicts the oldest.
      final merged = <String>{
        ...ids.where((id) => id.isNotEmpty),
        ..._prefs.getStringList(readIdsKey) ?? const <String>[],
      };

      final stored = merged.take(_maxStoredIds).toList(growable: false);
      await _prefs.setStringList(readIdsKey, stored);
      return stored.toSet();
    } catch (_) {
      throw const CacheException('Could not save your read notifications.');
    }
  }
}
