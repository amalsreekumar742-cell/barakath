import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../../products/domain/entities/variant.dart';
import '../../../products/domain/usecases/get_product_detail.dart';
import '../../../products/domain/usecases/get_product_variants.dart';
import '../../domain/entities/order.dart';
import '../../domain/usecases/get_orders.dart';

/// Explicit, named list states — never inferred from null-checks (skill rule).
enum OrdersState { initial, loading, loadingMore, loaded, error }

/// What a "Reorder" tap produced: the lines that can be added to the bag, plus
/// how many were dropped because the live catalogue no longer stocks them.
class ReorderResult {
  const ReorderResult({required this.items, required this.skipped});

  final List<CartItem> items;
  final int skipped;

  bool get isEmpty => items.isEmpty;
}

/// My Orders list (spec §2.17): filter tabs, cursor pagination, reorder.
///
/// Firebase is never touched here — every read goes through a use case.
@injectable
class OrdersProvider extends ChangeNotifier {
  OrdersProvider(
    this._getOrders,
    this._getProductDetail,
    this._getProductVariants,
  );

  final GetOrders _getOrders;
  final GetProductDetail _getProductDetail;
  final GetProductVariants _getProductVariants;

  OrdersState _state = OrdersState.initial;
  List<Order> _orders = const [];
  OrderFilter _filter = OrderFilter.all;
  Object? _cursor;
  bool _hasMore = false;
  String? _error;
  bool _isReordering = false;

  OrdersState get state => _state;
  List<Order> get orders => List.unmodifiable(_orders);
  OrderFilter get filter => _filter;
  bool get hasMore => _hasMore;
  bool get isLoading => _state == OrdersState.loading;
  bool get isLoadingMore => _state == OrdersState.loadingMore;
  bool get isReordering => _isReordering;
  String? get error => _error;

  /// Switch the filter tab. A no-op when the tab is already active, so tapping
  /// the current chip never costs a page read.
  Future<void> setFilter(OrderFilter filter) async {
    if (_filter == filter) return;
    _filter = filter;
    _orders = const [];
    _cursor = null;
    _hasMore = false;
    notifyListeners();
    await load();
  }

  /// First page for the active filter. Safe to call on every screen entry —
  /// [force] false skips the read when a page is already loaded.
  Future<void> load({bool force = true}) async {
    if (!force && _state == OrdersState.loaded) return;

    _state = OrdersState.loading;
    _error = null;
    notifyListeners();

    final result = await _getOrders(
      GetOrdersParams(filter: _filter, limit: AppDimens.pageSize),
    );
    result.fold(
      (failure) {
        _error = failure.message;
        _state = OrdersState.error;
      },
      (page) {
        _orders = page.items;
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
        _state = OrdersState.loaded;
      },
    );
    notifyListeners();
  }

  /// Next cursor page, appended to the current list.
  Future<void> loadMore() async {
    if (!_hasMore || _state == OrdersState.loadingMore || _cursor == null) {
      return;
    }
    _state = OrdersState.loadingMore;
    notifyListeners();

    final result = await _getOrders(
      GetOrdersParams(
        filter: _filter,
        limit: AppDimens.pageSize,
        startAfter: _cursor,
      ),
    );
    result.fold(
      (failure) {
        _error = failure.message;
        _state = OrdersState.loaded; // keep the rows already on screen
      },
      (page) {
        _orders = [..._orders, ...page.items];
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
        _state = OrdersState.loaded;
      },
    );
    notifyListeners();
  }

  /// Build the bag lines for a "Reorder" tap (spec §2.17 — out-of-stock items
  /// are dropped, not silently substituted).
  ///
  /// Prices are deliberately NOT carried over: `CartItem` stores no price and
  /// the server re-prices at checkout. What matters is that the product is still
  /// Active and the exact variant still has stock. Quantity is clamped to the
  /// §2.25 cap of 10 per variant.
  Future<ReorderResult> buildReorder(Order order) async {
    _isReordering = true;
    notifyListeners();

    final lines = <CartItem>[];
    var skipped = 0;

    for (final item in order.items) {
      final productResult = await _getProductDetail(item.productId);
      final product = productResult.fold((_) => null, (p) => p);
      if (product == null || product.status != 'Active') {
        skipped++;
        continue;
      }

      final variantsResult = await _getProductVariants(item.productId);
      final variants = variantsResult.fold((_) => null, (v) => v);
      Variant? variant;
      for (final v in variants ?? const <Variant>[]) {
        if (v.id == item.variantId) {
          variant = v;
          break;
        }
      }
      if (variant == null || !variant.inStock) {
        skipped++;
        continue;
      }

      lines.add(
        CartItem(
          productId: item.productId,
          variantId: item.variantId,
          productName: product.name,
          variantName: variant.name,
          variantColor: variant.color,
          productImage: item.productImage,
          // Never exceed what is actually on the shelf, nor the §2.25 cap.
          quantity: item.quantity.clamp(1, variant.stock).clamp(1, 10),
        ),
      );
    }

    _isReordering = false;
    notifyListeners();
    return ReorderResult(items: lines, skipped: skipped);
  }
}
