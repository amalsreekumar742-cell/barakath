import 'dart:convert';

import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/error/exceptions.dart';

/// On-device recent-search history. The ONLY place in this feature that touches
/// SharedPreferences (skill: persistence in datasources only). Stored as a JSON
/// array of strings, newest first.
abstract class SearchLocalDataSource {
  /// Recent terms, newest first. A missing or corrupt payload yields an empty
  /// list — a bad cache must never break the search screen.
  List<String> getRecentSearches();

  /// Push [term] to the front, deduped case-insensitively and capped at
  /// [SearchLocalDataSourceImpl.maxRecentSearches]. Returns the new list.
  Future<List<String>> addRecentSearch(String term);

  /// Remove [term] (case-insensitive). Returns the new list.
  Future<List<String>> removeRecentSearch(String term);

  Future<void> clearRecentSearches();
}

@LazySingleton(as: SearchLocalDataSource)
class SearchLocalDataSourceImpl implements SearchLocalDataSource {
  SearchLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  /// TODO(core): promote to `PrefKeys.recentSearches` in
  /// `core/utils/constants.dart` — kept local here only because that file is
  /// owned elsewhere in this build.
  static const String _prefsKey = 'recent_searches';

  /// The list is a memory aid, not an archive — older terms are of little use
  /// and an unbounded list would grow forever.
  static const int maxRecentSearches = 10;

  @override
  List<String> getRecentSearches() {
    final raw = _prefs.getString(_prefsKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded.whereType<String>().toList();
      }
      return [];
    } catch (_) {
      // Corrupt payload — start clean rather than crashing the screen.
      return [];
    }
  }

  @override
  Future<List<String>> addRecentSearch(String term) {
    final clean = term.trim();
    if (clean.isEmpty) return Future.value(getRecentSearches());

    final lower = clean.toLowerCase();
    final next = [
      clean,
      // Re-searching an existing term promotes it instead of duplicating it.
      ...getRecentSearches().where((t) => t.toLowerCase() != lower),
    ];
    if (next.length > maxRecentSearches) {
      next.removeRange(maxRecentSearches, next.length);
    }
    return _save(next);
  }

  @override
  Future<List<String>> removeRecentSearch(String term) {
    final lower = term.trim().toLowerCase();
    final next = getRecentSearches()
        .where((t) => t.toLowerCase() != lower)
        .toList();
    return _save(next);
  }

  @override
  Future<void> clearRecentSearches() async {
    try {
      await _prefs.remove(_prefsKey);
    } catch (e) {
      throw CacheException('Could not clear recent searches: $e');
    }
  }

  Future<List<String>> _save(List<String> terms) async {
    try {
      await _prefs.setString(_prefsKey, jsonEncode(terms));
      return terms;
    } catch (e) {
      throw CacheException('Could not save recent searches: $e');
    }
  }
}
