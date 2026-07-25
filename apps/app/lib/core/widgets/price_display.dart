import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../constants/app_colors.dart';

/// Displays a price in Indian Rupee formatting. When [originalPrice] is set and
/// greater than [price], shows the original struck-through alongside a bold
/// discounted price and (optionally) a discount-percentage badge.
class PriceDisplay extends StatelessWidget {
  const PriceDisplay({
    super.key,
    required this.price,
    this.originalPrice,
    this.fontSize = 15,
    this.showDiscountBadge = true,
  });

  final num price;
  final num? originalPrice;
  final double fontSize;
  final bool showDiscountBadge;

  static final NumberFormat _currency = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  bool get _hasDiscount => originalPrice != null && originalPrice! > price;

  int get _discountPercent {
    if (!_hasDiscount || originalPrice! <= 0) return 0;
    return (((originalPrice! - price) / originalPrice!) * 100).round();
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasDiscount) {
      return Text(
        _currency.format(price),
        style: TextStyle(
          color: AppColors.ink,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
        ),
      );
    }

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 4,
      children: [
        Text(
          _currency.format(price),
          style: TextStyle(
            color: AppColors.ink,
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          _currency.format(originalPrice),
          style: TextStyle(
            color: AppColors.muted,
            fontSize: fontSize - 2,
            fontWeight: FontWeight.w500,
            decoration: TextDecoration.lineThrough,
            decorationColor: AppColors.muted,
          ),
        ),
        if (showDiscountBadge && _discountPercent > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.success.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '$_discountPercent% OFF',
              style: TextStyle(
                color: AppColors.success,
                fontSize: fontSize - 4,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
      ],
    );
  }
}
