import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/constants/domain_enums.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../products/domain/usecases/get_product_detail.dart';
import '../../../replacement/domain/entities/replacement.dart';
import '../../domain/entities/invoice_business.dart';
import '../../domain/entities/order.dart';
import '../../domain/usecases/cancel_order.dart';
import '../../domain/usecases/generate_invoice.dart';
import '../../domain/usecases/get_invoice_business.dart';
import '../../domain/usecases/get_item_replacement.dart';
import '../../domain/usecases/get_order_by_id.dart';

/// Explicit, named states for the detail screen (skill rule).
enum OrderDetailState { initial, loading, loaded, error }

/// One order: detail, cancel, invoice generation, per-item replacement state.
///
/// Shared by Order Detail, Tracking and Invoice — all three render the same
/// document, so re-entering one of them from another costs no extra read.
@injectable
class OrderDetailProvider extends ChangeNotifier {
  OrderDetailProvider(
    this._getOrderById,
    this._getItemReplacement,
    this._getProductDetail,
    this._cancelOrder,
    this._generateInvoice,
    this._getInvoiceBusiness,
  );

  final GetOrderById _getOrderById;
  final GetItemReplacement _getItemReplacement;
  final GetProductDetail _getProductDetail;
  final CancelOrder _cancelOrder;
  final GenerateInvoice _generateInvoice;
  final GetInvoiceBusiness _getInvoiceBusiness;

  OrderDetailState _state = OrderDetailState.initial;
  Order? _order;
  String? _error;

  /// `productId|variantId` → the request already raised for that line.
  final Map<String, Replacement> _replacements = {};

  /// `productId` → whether the LIVE product still offers replacement. Read from
  /// the catalogue, not from the order: `replacementAvailable` is a product
  /// setting the admin can withdraw, and the order carries no copy of it.
  final Map<String, bool> _replacementAvailable = {};

  bool _isCancelling = false;
  bool _isGeneratingInvoice = false;
  String? _invoiceUrl;
  InvoiceBusiness _business = InvoiceBusiness.empty;

  OrderDetailState get state => _state;
  Order? get order => _order;
  String? get error => _error;
  bool get isLoading => _state == OrderDetailState.loading;
  bool get isCancelling => _isCancelling;
  bool get isGeneratingInvoice => _isGeneratingInvoice;
  String? get invoiceUrl => _invoiceUrl;

  /// Seller details for the invoice header/footer. Safe defaults until loaded,
  /// so the invoice never renders a blank company name.
  InvoiceBusiness get business => _business;

  static String itemKey(String productId, String variantId) =>
      '$productId|$variantId';

  /// The request already raised for one line, or null.
  Replacement? replacementFor(String productId, String variantId) =>
      _replacements[itemKey(productId, variantId)];

  /// Whether the live product still allows a replacement request.
  bool canReplace(String productId) =>
      _replacementAvailable[productId] ?? false;

  /// The lines a replacement can still be raised for: delivered order, live
  /// product still offering replacement, and no request raised yet.
  ///
  /// Drives the single "Replacement" button in the footer — which needs to know
  /// whether to be enabled, and whether tapping it should go straight to a line
  /// or ask which one. Empty on a non-delivered order, since `_loadItemState`
  /// only populates the maps once an order is delivered.
  List<OrderItem> get replaceableItems {
    final order = _order;
    if (order == null) return const [];
    return order.items
        .where((item) =>
            canReplace(item.productId) &&
            replacementFor(item.productId, item.variantId) == null)
        .toList();
  }

  /// Load (or reload) one order plus its per-item replacement state.
  ///
  /// [force] false is the "I'm arriving from another screen that already loaded
  /// this order" path — Tracking and Invoice use it so a back-navigation is free.
  Future<void> load(String orderId, {bool force = true}) async {
    if (!force && _order?.id == orderId && _state == OrderDetailState.loaded) {
      return;
    }

    _state = OrderDetailState.loading;
    _error = null;
    if (_order?.id != orderId) {
      _order = null;
      _invoiceUrl = null;
      _replacements.clear();
      _replacementAvailable.clear();
    }
    notifyListeners();

    final result = await _getOrderById(orderId);
    await result.fold(
      (failure) async {
        _error = failure.message;
        _state = OrderDetailState.error;
      },
      (order) async {
        _order = order;
        _invoiceUrl = order.invoiceUrl.isEmpty ? null : order.invoiceUrl;
        _state = OrderDetailState.loaded;
        await _loadItemState(order);
      },
    );
    notifyListeners();
  }

  /// Per-line catalogue + replacement lookups.
  ///
  /// Only for a DELIVERED order: "Return / Replace" is a post-delivery action
  /// (spec §2.17), so on an in-flight order these reads would be pure waste.
  Future<void> _loadItemState(Order order) async {
    if (OrderStatusX.from(order.status) != OrderStatus.delivered) return;

    for (final item in order.items) {
      if (!_replacementAvailable.containsKey(item.productId)) {
        final product = await _getProductDetail(item.productId);
        _replacementAvailable[item.productId] =
            product.fold((_) => false, (p) => p.replacementAvailable);
      }

      final existing = await _getItemReplacement(
        ItemReplacementParams(
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
        ),
      );
      existing.fold(
        (_) {},
        (replacement) {
          if (replacement != null) {
            _replacements[itemKey(item.productId, item.variantId)] =
                replacement;
          }
        },
      );
    }
  }

  /// Cancel a still-Pending order. Returns null on success, else the message to
  /// toast.
  ///
  /// SERVER GATE: the deployed `cancelOrder` callable begins with
  /// `validateAdmin(request)`, so a customer caller is rejected
  /// `permission-denied`. The failure is surfaced verbatim — orders are
  /// `allow update: if isAdmin()` in the rules, so there is no client-side
  /// alternative, and inventing one would skip the refund and stock restore.
  Future<String?> cancelOrder({String reason = 'Cancelled by customer'}) async {
    final order = _order;
    if (order == null) return 'No order loaded.';

    _isCancelling = true;
    notifyListeners();

    final result = await _cancelOrder(
      CancelOrderParams(orderId: order.id, reason: reason),
    );

    String? message;
    await result.fold(
      (failure) async => message = failure.message,
      (_) async => load(order.id),
    );

    _isCancelling = false;
    notifyListeners();
    return message;
  }

  /// Load the seller block for the invoice. A failure is silent — the invoice
  /// still renders with [InvoiceBusiness.empty], which carries the store name.
  Future<void> loadBusiness() async {
    if (_business != InvoiceBusiness.empty) return;
    final result = await _getInvoiceBusiness(const NoParams());
    result.fold((_) {}, (business) => _business = business);
    notifyListeners();
  }

  /// Render the invoice PDF and cache its URL. Returns null on success, else
  /// the message to toast.
  Future<String?> generateInvoice() async {
    final order = _order;
    if (order == null) return 'No order loaded.';

    _isGeneratingInvoice = true;
    notifyListeners();

    final result = await _generateInvoice(order.id);
    String? message;
    result.fold(
      (failure) => message = failure.message,
      (url) => _invoiceUrl = url,
    );

    _isGeneratingInvoice = false;
    notifyListeners();
    return message;
  }
}
