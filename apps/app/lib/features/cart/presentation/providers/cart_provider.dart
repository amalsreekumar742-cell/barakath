import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../checkout/domain/entities/coupon.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../../../settings/domain/entities/general_settings.dart';
import '../../domain/entities/cart_details.dart';
import '../../domain/entities/cart_item.dart';
import '../../domain/usecases/add_to_cart.dart';
import '../../domain/usecases/clear_cart.dart';
import '../../domain/usecases/fetch_cart_details.dart';
import '../../domain/usecases/get_cart.dart';
import '../../domain/usecases/remove_from_cart.dart';
import '../../domain/usecases/update_quantity.dart';

/// Holds the local shopping cart (spec §2.5 Bag tab).
///
/// The cart lives entirely on-device (SharedPreferences) — it is NOT a Firestore
/// document. Only line identity and quantity are persisted; price is re-read live
/// at checkout so a stale cart can never lock in an outdated price.
///
/// This provider owns NO persistence logic: it calls use cases, folds their
/// `Either` results, and exposes the resulting state. On any failure it keeps the
/// last-known items so the UI never regresses to an empty cart on a transient
/// cache error.
@injectable
class CartProvider extends ChangeNotifier {
  CartProvider(
    this._getCart,
    this._addToCart,
    this._removeFromCart,
    this._updateQuantity,
    this._clearCart,
    this._fetchCartDetails,
  );

  final GetCart _getCart;
  final AddToCart _addToCart;
  final RemoveFromCart _removeFromCart;
  final UpdateQuantity _updateQuantity;
  final ClearCart _clearCart;
  final FetchCartDetails _fetchCartDetails;

  List<CartItem> _items = [];

  // --- Live catalogue state (spec §2.10) ------------------------------------
  CartDetails _details = const CartDetails.empty();
  bool _isValidating = false;
  String? _validationError;

  /// Human-readable adjustments made during the last validate ("X is no longer
  /// available", "Quantity adjusted for Y") for the page to surface as toasts.
  final List<String> _notices = [];

  Coupon? _appliedCoupon;
  double _couponDiscount = 0;

  /// Delivery config comes from admin settings; the page injects it before
  /// reading the money getters so this provider stays free of a settings
  /// dependency. GST is no longer among them — it is included in the price and
  /// is per-variant, not a single global rate (see [gstAmount]).
  List<DeliverySlab> _deliverySlabs = const [];
  double _freeDeliveryThreshold = 0;

  /// The current cart lines (read-only view).
  List<CartItem> get items => List.unmodifiable(_items);

  /// Sum of quantities across all lines — drives the bag tab badge.
  int get itemCount => _items.fold(0, (sum, item) => sum + item.quantity);

  /// Is ANY variant of this product already in the bag?
  bool containsProduct(String productId) =>
      _items.any((item) => item.productId == productId);

  /// Is this exact variant in the bag? Detail pages need the variant-level
  /// answer, since switching variant should offer "Add" again.
  bool containsVariant(String productId, String variantId) => _items.any(
        (item) => item.productId == productId && item.variantId == variantId,
      );

  bool get isValidating => _isValidating;
  String? get validationError => _validationError;
  CartDetails get details => _details;
  Coupon? get appliedCoupon => _appliedCoupon;
  double get couponDiscount => _couponDiscount;

  Product? productFor(CartItem item) => _details.products[item.productId];
  Variant? variantFor(CartItem item) => _details.variants[item.variantId];

  /// The products currently in the bag — coupon applicability is checked against
  /// these (category/product scoped coupons).
  List<Product> get cartProducts =>
      _items.map(productFor).whereType<Product>().toList();

  /// Drain the pending notices; the caller shows them once.
  List<String> takeNotices() {
    final out = List<String>.from(_notices);
    _notices.clear();
    return out;
  }

  /// Feed in the admin's delivery config (from GeneralSettingsProvider).
  void applySettings({
    required List<DeliverySlab> slabs,
    required double freeDeliveryThreshold,
  }) {
    _deliverySlabs = slabs;
    _freeDeliveryThreshold = freeDeliveryThreshold;
  }

  // --- Money ----------------------------------------------------------------
  // Every figure here is for DISPLAY. createPaymentOrder recomputes the whole
  // bill server-side from the same rules, and that is what the customer is
  // charged — so a stale local price can mislead but can never overcharge.

  double get subtotal {
    var total = 0.0;
    for (final item in _items) {
      final variant = variantFor(item);
      if (variant == null) continue;
      total += variant.effectivePrice * item.quantity;
    }
    return total;
  }

  /// What delivery will cost.
  ///
  /// MUST mirror `computeDeliveryCharge` in
  /// `functions/src/orders/service/computeTotals.ts`, because that is what the
  /// customer is actually charged — anything shown here that disagrees is a
  /// quoted price the checkout won't honour. The rule (spec §2.13):
  ///
  ///   1. Any combo in the bag REPLACES the standard fee, and the LARGEST combo
  ///      charge wins — it all ships together. The free-delivery threshold does
  ///      not apply to combos.
  ///   2. Otherwise the standard fee, waived once the subtotal clears the
  ///      free-delivery threshold.
  ///
  /// This used to read `base + combo` with `combo` SUMMED across lines, which
  /// over-stated the total against a server that charges `max(combo)` alone.
  double get deliveryCharge {
    if (_items.isEmpty) return 0;
    final combo = largestComboCharge;
    if (combo != null) return combo;
    if (_freeDeliveryThreshold > 0 && subtotal >= _freeDeliveryThreshold) {
      return 0;
    }
    return baseDeliveryCharge;
  }

  /// The slab fee alone, ignoring the free-delivery waiver — the bag shows this
  /// struck through next to "FREE".
  double get baseDeliveryCharge {
    for (final slab in _deliverySlabs) {
      final aboveMin = subtotal >= slab.minAmount;
      final belowMax = slab.maxAmount == null || subtotal <= slab.maxAmount!;
      if (aboveMin && belowMax) return slab.fee;
    }
    return 0;
  }

  /// The single bundle delivery charge for the bag, or `null` when it holds no
  /// combo. The LARGEST wins rather than the sum: several combos still ship as
  /// one consignment, and the server charges `max(...)`.
  double? get largestComboCharge {
    double? largest;
    for (final item in _items) {
      final product = productFor(item);
      if (product == null || !product.isCombo) continue;
      final charge = product.comboDeliveryCharge;
      if (largest == null || charge > largest) largest = charge;
    }
    return largest;
  }

  /// True only when the standard fee was actually waived by the threshold — the
  /// bag strikes [baseDeliveryCharge] through beside "FREE" so the saving shows.
  /// A combo bag is excluded: its charge is never waived, so nothing was saved.
  bool get hasFreeDelivery =>
      largestComboCharge == null &&
      _freeDeliveryThreshold > 0 &&
      subtotal >= _freeDeliveryThreshold &&
      baseDeliveryCharge > 0;

  /// Always 0 in a PRE-ORDER preview: GST is INCLUDED in catalogue prices
  /// (2026-08-04), so there is nothing to add to the bag total, and the real
  /// per-line split needs each variant's own `gstPercentage` — which a cart line
  /// does not carry. The itemised tax appears on the order and its invoice,
  /// computed server-side from the rates snapshotted at checkout.
  ///
  /// Kept as a getter (rather than deleted) because the bag and checkout screens
  /// pass it to [PriceSummary], which hides the row when it is 0.
  double get gstAmount => 0;

  /// Mirrors `computeOrderTotals` server-side. GST is deliberately NOT added —
  /// it is already inside `subtotal`. Adding it here would quote the customer a
  /// total higher than the one they are actually charged.
  double get grandTotal {
    final total = subtotal - _couponDiscount + deliveryCharge;
    return total < 0 ? 0 : total;
  }

  /// MRP savings plus the coupon — what the bag advertises as "You save …".
  double get totalSavings {
    var saved = 0.0;
    for (final item in _items) {
      final variant = variantFor(item);
      if (variant == null) continue;
      final off = variant.mrp - variant.effectivePrice;
      if (off > 0) saved += off * item.quantity;
    }
    return saved + _couponDiscount;
  }

  // --- Coupon ---------------------------------------------------------------

  void applyCoupon(Coupon coupon, double discount) {
    _appliedCoupon = coupon;
    _couponDiscount = discount;
    notifyListeners();
  }

  void removeCoupon() {
    _appliedCoupon = null;
    _couponDiscount = 0;
    notifyListeners();
  }

  // --- Validation -----------------------------------------------------------

  /// Re-read every line from Firestore, drop what's gone and clamp what's short
  /// of stock (spec §2.10). Call on entering the bag AND before checkout.
  Future<void> validateAndFetchPrices() async {
    if (_items.isEmpty) {
      _details = const CartDetails.empty();
      _isValidating = false;
      notifyListeners();
      return;
    }

    _isValidating = true;
    _validationError = null;
    notifyListeners();

    final result = await _fetchCartDetails(
      FetchCartDetailsParams(
        _items.map((i) => (productId: i.productId, variantId: i.variantId)).toList(),
      ),
    );

    await result.fold(
      (failure) async {
        _validationError = failure.message;
      },
      (details) async {
        _details = details;
        await _reconcile(details);
      },
    );

    _isValidating = false;
    notifyListeners();
  }

  /// Remove unavailable lines and clamp over-stock quantities, recording a notice
  /// for each so the customer is told why their bag changed under them.
  Future<void> _reconcile(CartDetails details) async {
    for (final item in List<CartItem>.from(_items)) {
      final product = details.products[item.productId];
      final variant = details.variants[item.variantId];

      final unavailable =
          product == null || variant == null || product.status != 'Active';
      if (unavailable) {
        _notices.add('${item.productName} is no longer available');
        await _removeFromCart(
          RemoveFromCartParams(productId: item.productId, variantId: item.variantId),
        ).then((r) => r.fold((_) {}, (items) => _items = items));
        continue;
      }

      if (variant.stock <= 0) {
        _notices.add('${item.productName} is out of stock');
        await _removeFromCart(
          RemoveFromCartParams(productId: item.productId, variantId: item.variantId),
        ).then((r) => r.fold((_) {}, (items) => _items = items));
        continue;
      }

      if (item.quantity > variant.stock) {
        _notices.add('Quantity adjusted for ${item.productName}');
        await _updateQuantity(
          UpdateQuantityParams(
            productId: item.productId,
            variantId: item.variantId,
            quantity: variant.stock,
          ),
        ).then((r) => r.fold((_) {}, (items) => _items = items));
      }
    }

    // A coupon that qualified on the old subtotal may not on the new one.
    if (_appliedCoupon != null && subtotal < _appliedCoupon!.minimumOrderAmount) {
      removeCoupon();
      _notices.add('Coupon removed — your bag no longer meets the minimum');
    }
  }

  /// Rehydrate the cart from local storage. Call once at startup.
  Future<void> load() async {
    final result = await _getCart(const NoParams());
    result.fold(
      (_) => _items = const [],
      (items) => _items = items,
    );
    notifyListeners();
  }

  /// Add a line to the cart. If the same product+variant is already present its
  /// quantity is incremented by the incoming quantity instead of duplicating.
  void addToCart(CartItem item) => _apply(_addToCart(item));

  /// Remove a line entirely.
  void removeFromCart(String productId, String variantId) => _apply(
        _removeFromCart(
          RemoveFromCartParams(productId: productId, variantId: variantId),
        ),
      );

  /// Set the absolute quantity for a line. Removes the line when [qty] <= 0.
  /// Returns whether it succeeded, so the stepper can toast on failure instead
  /// of leaving a tap silently doing nothing.
  Future<bool> updateQuantity(String productId, String variantId, int qty) =>
      _applyBool(
        _updateQuantity(
          UpdateQuantityParams(
            productId: productId,
            variantId: variantId,
            quantity: qty,
          ),
        ),
      );

  /// Empty the cart (e.g. after a successful checkout).
  void clearCart() => _apply(_clearCart(const NoParams()));

  /// Await a mutation use case and, on success, adopt the returned lines. On
  /// failure the current state is kept (persistence logic lives in the data
  /// layer; the provider only reflects results).
  void _apply(Future<Either<Failure, List<CartItem>>> future) {
    future.then((result) {
      result.fold(
        (_) {},
        (items) {
          _items = items;
          notifyListeners();
        },
      );
    });
  }

  /// Same as [_apply], but awaited and reporting success/failure — used only by
  /// [updateQuantity], whose caller needs to know if the tap actually did
  /// anything.
  Future<bool> _applyBool(Future<Either<Failure, List<CartItem>>> future) async {
    final result = await future;
    return result.fold((_) => false, (items) {
      _items = items;
      notifyListeners();
      return true;
    });
  }
}
