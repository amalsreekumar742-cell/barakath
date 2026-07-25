import 'dart:convert';

import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/constants.dart';
import '../models/cart_item_model.dart';

/// Local persistence for the shopping bag. The ONLY place that touches
/// SharedPreferences (skill: persistence in datasources only). Reads/writes a
/// JSON list under [PrefKeys.cart]; throws [CacheException] on a write failure.
abstract class CartLocalDataSource {
  /// The persisted cart lines. A missing or corrupt payload yields an empty
  /// list (a bad cache must never crash the app) rather than throwing.
  List<CartItemModel> getCart();

  /// Persist the full cart line list. Throws [CacheException] on failure.
  Future<void> saveCart(List<CartItemModel> items);
}

@LazySingleton(as: CartLocalDataSource)
class CartLocalDataSourceImpl implements CartLocalDataSource {
  CartLocalDataSourceImpl(this._prefs);

  final SharedPreferences _prefs;

  @override
  List<CartItemModel> getCart() {
    final raw = _prefs.getString(PrefKeys.cart);
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .whereType<Map>()
            .map((e) => CartItemModel.fromJson(Map<String, dynamic>.from(e)))
            .toList();
      }
      return [];
    } catch (_) {
      // Corrupt payload — start clean rather than crashing the app.
      return [];
    }
  }

  @override
  Future<void> saveCart(List<CartItemModel> items) async {
    try {
      final encoded = jsonEncode(items.map((e) => e.toJson()).toList());
      await _prefs.setString(PrefKeys.cart, encoded);
    } catch (e) {
      throw CacheException('Could not save cart: $e');
    }
  }
}
