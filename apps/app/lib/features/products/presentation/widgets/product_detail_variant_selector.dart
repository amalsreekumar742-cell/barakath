import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../domain/entities/variant.dart';

/// Horizontal variant chips: a colour swatch + the variant name.
///
/// Sold-out variants stay tappable on purpose — the shopper gets an explicit
/// "out of stock" message instead of a dead chip that seems broken.
class ProductDetailVariantSelector extends StatelessWidget {
  const ProductDetailVariantSelector({
    super.key,
    required this.variants,
    required this.selectedVariantId,
    required this.onSelect,
    required this.onOutOfStockTap,
  });

  final List<Variant> variants;
  final String? selectedVariantId;
  final ValueChanged<Variant> onSelect;
  final ValueChanged<Variant> onOutOfStockTap;

  @override
  Widget build(BuildContext context) {
    if (variants.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Select variant',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 46,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: variants.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final variant = variants[i];
              final selected = variant.id == selectedVariantId;
              final soldOut = variant.stock <= 0;
              return _VariantChip(
                variant: variant,
                selected: selected,
                soldOut: soldOut,
                onTap: () =>
                    soldOut ? onOutOfStockTap(variant) : onSelect(variant),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _VariantChip extends StatelessWidget {
  const _VariantChip({
    required this.variant,
    required this.selected,
    required this.soldOut,
    required this.onTap,
  });

  final Variant variant;
  final bool selected;
  final bool soldOut;
  final VoidCallback onTap;

  /// `colorCode` is authored as `#RRGGBB` in the admin; anything unparseable
  /// falls back to the neutral fill so the chip never renders a black hole.
  Color get _swatchColor {
    final raw = variant.colorCode.replaceAll('#', '').trim();
    if (raw.length != 6) return AppColors.subtle;
    final value = int.tryParse('FF$raw', radix: 16);
    return value == null ? AppColors.subtle : Color(value);
  }

  @override
  Widget build(BuildContext context) {
    final label = variant.name.isNotEmpty ? variant.name : variant.color;

    return Opacity(
      opacity: soldOut ? 0.45 : 1,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.brandGreenSubtle : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.brandGreen : AppColors.border,
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 16,
                width: 16,
                decoration: BoxDecoration(
                  color: _swatchColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: selected ? AppColors.brandGreen : AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (soldOut) ...[
                const SizedBox(width: 8),
                const Text(
                  'Out of stock',
                  style: TextStyle(
                    color: AppColors.danger,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
