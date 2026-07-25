import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

/// The shared money breakdown, used by both the bag and checkout so the two can
/// never drift into showing different arithmetic for the same basket.
class PriceSummary extends StatelessWidget {
  const PriceSummary({
    super.key,
    required this.subtotal,
    required this.couponDiscount,
    required this.deliveryCharge,
    required this.baseDeliveryCharge,
    required this.hasFreeDelivery,
    required this.gstAmount,
    required this.total,
    required this.totalSavings,
    this.walletDeduction = 0,
    this.totalLabel = 'Total',
  });

  final double subtotal;
  final double couponDiscount;
  final double deliveryCharge;
  final double baseDeliveryCharge;
  final bool hasFreeDelivery;
  final double gstAmount;
  final double total;
  final double totalSavings;
  final double walletDeduction;
  final String totalLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _Row(label: 'Subtotal', value: '₹${subtotal.toStringAsFixed(0)}'),
        if (couponDiscount > 0)
          _Row(
            label: 'Coupon discount',
            value: '-₹${couponDiscount.toStringAsFixed(0)}',
            valueColor: AppColors.success,
          ),
        if (walletDeduction > 0)
          _Row(
            label: 'Wallet',
            value: '-₹${walletDeduction.toStringAsFixed(0)}',
            valueColor: AppColors.success,
          ),
        _DeliveryRow(
          charge: deliveryCharge,
          baseCharge: baseDeliveryCharge,
          isFree: hasFreeDelivery,
        ),
        if (gstAmount > 0)
          _Row(label: 'GST', value: '+₹${gstAmount.toStringAsFixed(0)}'),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 10),
          child: Divider(height: 1, color: AppColors.hairline),
        ),
        // The total is the one gold figure on the card, per the design.
        _Row(
          label: totalLabel,
          value: '₹${total.toStringAsFixed(0)}',
          valueColor: AppColors.goldStrong,
          bold: true,
          fontSize: 20,
        ),
        if (totalSavings > 0) ...[
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'You save ₹${totalSavings.toStringAsFixed(0)}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.success,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _DeliveryRow extends StatelessWidget {
  const _DeliveryRow({
    required this.charge,
    required this.baseCharge,
    required this.isFree,
  });

  final double charge;
  final double baseCharge;
  final bool isFree;

  @override
  Widget build(BuildContext context) {
    if (!isFree) {
      return _Row(
        label: 'Delivery',
        value: charge <= 0 ? 'FREE' : '₹${charge.toStringAsFixed(0)}',
        valueColor: charge <= 0 ? AppColors.success : null,
      );
    }
    // Threshold met — show what it would have cost, struck through, so the
    // saving is visible rather than silently absorbed.
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          const Expanded(
            child: Text('Delivery',
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
          ),
          Text(
            '₹${baseCharge.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.muted,
              decoration: TextDecoration.lineThrough,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            charge <= 0 ? 'FREE' : '₹${charge.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.success,
            ),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.value,
    this.valueColor,
    this.bold = false,
    this.fontSize = 14,
  });

  final String label;
  final String value;
  final Color? valueColor;
  final bool bold;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: bold ? FontWeight.w800 : FontWeight.w400,
                color: bold ? AppColors.textPrimary : AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}
