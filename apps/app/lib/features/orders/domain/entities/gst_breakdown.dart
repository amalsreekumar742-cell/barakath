import 'package:equatable/equatable.dart';

import 'order.dart';

/// One row of an invoice's rate-wise GST breakup.
///
/// MIRRORS `packages/shared/src/utils/gstBreakdown.ts`. Keep the two in lockstep: the admin's
/// printable Tax Invoice and this screen must state identical figures for the same order, and Dart
/// cannot import the TypeScript package.
class GstBreakdownRow extends Equatable {
  const GstBreakdownRow({
    required this.percentage,
    required this.taxableValue,
    required this.gstAmount,
  });

  /// The GST rate as a percentage (18 = 18%).
  final double percentage;

  /// Value the tax was charged on — line subtotal net of its share of any coupon discount.
  final double taxableValue;

  final double gstAmount;

  @override
  List<Object?> get props => [percentage, taxableValue, gstAmount];
}

double _round2(double n) => (n * 100).roundToDouble() / 100;

/// Groups an order's lines by GST rate.
///
/// Returns an EMPTY list for an order placed before per-line GST existed. Those orders carry only the
/// order-level `gstAmount`, and deriving a split for them from today's rate would put a fabricated
/// figure on a tax document — the caller shows the single total instead.
///
/// Reads each line's stored `gstAmount` rather than recomputing it from the rate: those amounts are
/// what the customer actually paid, and recomputing would drift from the order's `gstAmount` by the
/// rounding.
List<GstBreakdownRow> gstBreakdown(Order order) {
  final items = order.items;
  final hasLineGst = items.isNotEmpty &&
      items.every((i) => i.gstPercentage != null && i.gstAmount != null);
  if (!hasLineGst) return const [];

  final subtotal = order.subtotal > 0
      ? order.subtotal
      : items.fold<double>(0, (sum, i) => sum + i.subtotal);
  final discount = order.couponDiscount;

  final byRate = <double, GstBreakdownRow>{};
  for (final item in items) {
    final percentage = item.gstPercentage!;
    // The same apportionment the server used when it charged the tax.
    final share = subtotal > 0 ? item.subtotal / subtotal : 0;
    final taxable = item.subtotal - discount * share;

    final existing = byRate[percentage];
    byRate[percentage] = GstBreakdownRow(
      percentage: percentage,
      taxableValue: (existing?.taxableValue ?? 0) + (taxable < 0 ? 0 : taxable),
      gstAmount: (existing?.gstAmount ?? 0) + item.gstAmount!,
    );
  }

  final rows = byRate.values
      .map(
        (r) => GstBreakdownRow(
          percentage: r.percentage,
          taxableValue: _round2(r.taxableValue),
          gstAmount: _round2(r.gstAmount),
        ),
      )
      .toList()
    ..sort((a, b) => a.percentage.compareTo(b.percentage));
  return rows;
}
