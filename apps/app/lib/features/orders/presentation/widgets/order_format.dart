import 'package:intl/intl.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../domain/entities/order.dart';

/// Money / date / reference formatting shared by every orders screen, so the
/// same amount never renders `₹1,234` on one card and `₹1234.00` on the next.
class OrderFormat {
  const OrderFormat._();

  static final NumberFormat _money = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  static final NumberFormat _whole = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  static final DateFormat _date = DateFormat('d MMM yyyy');
  static final DateFormat _dateShort = DateFormat('EEE, d MMM');
  static final DateFormat _dateTime = DateFormat('d MMM, h:mm a');

  /// Two decimals — price summaries, the invoice, anything auditable.
  static String money(double amount) => _money.format(amount);

  /// No decimals — card subtitles, where the exact paise is noise.
  static String moneyWhole(double amount) => _whole.format(amount);

  static String date(DateTime? value) => value == null ? '—' : _date.format(value);

  static String dateShort(DateTime? value) =>
      value == null ? '—' : _dateShort.format(value);

  static String dateTime(DateTime? value) =>
      value == null ? '—' : _dateTime.format(value);

  /// The order reference shown to the customer.
  ///
  /// The deployed order document has NO human `orderId` / `#BRK-XXXXX` field —
  /// the Firestore document id IS the reference (it is also what the invoice
  /// Cloud Function shortens into `INV-…`).
  ///
  /// Format is `#` + the first 8 characters, case PRESERVED. That matches the
  /// admin panel's order list and customer-orders tab (`OrdersPage.tsx`,
  /// `CustomerOrdersTab.tsx`) — the two screens support actually reads from — so
  /// a customer quoting their reference finds the same string an agent is
  /// looking at. Case is preserved deliberately: Firestore ids are
  /// case-sensitive, and the admin's `RecentOrders` widget upper-cases its copy,
  /// which produces a reference that matches nothing if pasted back.
  static String reference(Order order) => referenceFromId(order.id);

  /// [reference] for callers that hold only the document id (the order-success
  /// screen, which runs before the order document is fetched). Both paths go
  /// through here so the confirmation screen and order history can never show
  /// two different references for one order.
  static String referenceFromId(String id) {
    if (id.isEmpty) return '—';
    return id.length <= 8 ? '#$id' : '#${id.substring(0, 8)}';
  }

  /// "3 items · ₹1,299" — the card subtitle.
  static String itemsAndTotal(Order order) {
    final count = order.totalItems;
    final noun = count == 1 ? 'item' : 'items';
    return '$count $noun · ${moneyWhole(order.grandTotal)}';
  }

  /// What the customer saved: per-line MRP headroom plus the coupon.
  static double savings(Order order) {
    var saved = order.couponDiscount;
    for (final item in order.items) {
      final off = item.mrp - item.offerPrice;
      if (off > 0) saved += off * item.quantity;
    }
    return saved;
  }

  /// The timestamp a given step reached, read off `statusTimeline`.
  ///
  /// The deployed schema has NO `pendingAt`/`acceptedAt`/… columns — the whole
  /// history is this one array — so every "when did X happen" question in the
  /// app resolves through here.
  static DateTime? timestampFor(Order order, OrderStatus status) {
    for (final entry in order.statusTimeline) {
      if (OrderStatusX.from(entry.status) == status) return entry.timestamp;
    }
    return null;
  }

  /// The note the admin attached to a step, if any.
  static String noteFor(Order order, OrderStatus status) {
    for (final entry in order.statusTimeline) {
      if (OrderStatusX.from(entry.status) == status) return entry.note;
    }
    return '';
  }

  /// Estimated delivery date.
  ///
  /// GAP: the deployed order document carries no ETA/promised-date field, and
  /// there is no courier API wired up (spec Part 8 defers Shadowfax). So this is
  /// a DERIVED estimate — createdAt + [_etaDays] — and every screen that shows
  /// it labels it "Estimated", never "Arriving by", so the store is not promising
  /// a date it has not committed to.
  static const int _etaDays = 5;

  static DateTime? estimatedDelivery(Order order) {
    final delivered = timestampFor(order, OrderStatus.delivered);
    if (delivered != null) return delivered;
    final created = order.createdAt;
    return created?.add(const Duration(days: _etaDays));
  }

  /// Payment method as the customer should read it.
  ///
  /// Returns null for a Cash-on-Delivery value. COD is removed from the product
  /// (design map §4 conflict 7) even though the prototype draws it, so rather
  /// than rendering a method the store does not offer, the row is dropped.
  static String? paymentMethod(Order order) {
    final value = order.paymentMethod.trim();
    final normalised = value.toLowerCase().replaceAll(RegExp(r'[^a-z]'), '');
    if (normalised == 'cod' || normalised == 'cashondelivery') return null;
    if (value.isEmpty) return null;
    return switch (value.toLowerCase()) {
      'both' => 'Wallet + Razorpay',
      'wallet' => 'Wallet',
      'razorpay' => 'Razorpay',
      _ => value,
    };
  }
}
