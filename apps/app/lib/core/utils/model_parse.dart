import 'package:cloud_firestore/cloud_firestore.dart';

/// Shared null-safe parsing helpers used by every model's `fromFirestore`.
///
/// Firestore may store money either as `int` or `double`, dates as `Timestamp`,
/// and any field may simply be absent on a partially-written document — these
/// helpers centralise the defensive parsing so each model stays terse.
class ModelParse {
  const ModelParse._();

  /// Parse a Firestore [Timestamp] (or ISO string / epoch millis) into a
  /// [DateTime]. Returns `null` when the field is missing or unparseable.
  static DateTime? dateTime(dynamic value) {
    if (value == null) return null;
    if (value is Timestamp) return value.toDate();
    if (value is DateTime) return value;
    // `num`, not `int`: JSON has one number type, so a callable's response can
    // deliver epoch millis as a double. Testing `is int` silently returned null
    // for those and dropped the value (e.g. a spin coupon's expiry).
    if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
    if (value is String) return DateTime.tryParse(value);
    return null;
  }

  /// Money / any numeric field → `double` (Firestore may store int or double).
  static double toDouble(dynamic value, [double fallback = 0]) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? fallback;
    return fallback;
  }

  /// Integer field, tolerant of `num`/`String` storage.
  static int toInt(dynamic value, [int fallback = 0]) {
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
    return fallback;
  }

  static String toStr(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    return value.toString();
  }

  static bool toBool(dynamic value, [bool fallback = false]) {
    if (value is bool) return value;
    if (value is String) return value.toLowerCase() == 'true';
    if (value is num) return value != 0;
    return fallback;
  }

  /// A `List<String>` from a Firestore array, dropping nulls.
  static List<String> stringList(dynamic value) {
    if (value is List) {
      return value.where((e) => e != null).map((e) => e.toString()).toList();
    }
    return const [];
  }

  /// A `List<Map<String, dynamic>>` from a Firestore array of maps.
  static List<Map<String, dynamic>> mapList(dynamic value) {
    if (value is List) {
      return value
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return const [];
  }

  /// A nested `Map<String, dynamic>` (e.g. one settings tab), never null.
  static Map<String, dynamic> map(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return const {};
  }
}
