import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../domain/entities/variant_option.dart';

/// Two independent selection rows — Colour, then Size — instead of one combined
/// variant chip.
///
/// WHY the rows are rendered separately but resolved together: a variant is a
/// (colour, size) pair and the catalogue's pairs are sparse, so the provider
/// decides which variant a tap lands on (see its "Colour / size axes" note).
/// This widget stays dumb: it draws chips and reports which value was tapped.
///
/// Sold-out values stay tappable on purpose — the shopper gets an explicit
/// "out of stock" message and a page that reflects it, instead of a dead chip
/// that seems broken. A row with no values is omitted entirely rather than
/// rendering a header over nothing.
class ProductDetailVariantSelector extends StatelessWidget {
  const ProductDetailVariantSelector({
    super.key,
    required this.colorOptions,
    required this.sizeOptions,
    required this.selectedColor,
    required this.selectedSize,
    required this.onSelectColor,
    required this.onSelectSize,
  });

  final List<VariantOption> colorOptions;
  final List<VariantOption> sizeOptions;
  final String selectedColor;
  final String selectedSize;
  final ValueChanged<String> onSelectColor;
  final ValueChanged<String> onSelectSize;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[
      if (colorOptions.isNotEmpty)
        _AxisRow(
          label: 'Colour',
          selected: selectedColor,
          options: colorOptions,
          onSelect: onSelectColor,
        ),
      if (sizeOptions.isNotEmpty)
        _AxisRow(
          label: 'Size',
          selected: selectedSize,
          options: sizeOptions,
          onSelect: onSelectSize,
        ),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const SizedBox(height: 18),
          rows[i],
        ],
      ],
    );
  }
}

class _AxisRow extends StatelessWidget {
  const _AxisRow({
    required this.label,
    required this.selected,
    required this.options,
    required this.onSelect,
  });

  final String label;
  final String selected;
  final List<VariantOption> options;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
          child: Row(
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              // The current value beside the heading, so the choice reads at a
              // glance without scanning the row for the highlighted chip.
              Expanded(
                child: Text(
                  selected,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 46,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
            itemCount: options.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final option = options[i];
              return _OptionChip(
                option: option,
                selected: option.value == selected,
                onTap: () => onSelect(option.value),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _OptionChip extends StatelessWidget {
  const _OptionChip({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final VariantOption option;
  final bool selected;
  final VoidCallback onTap;

  /// `colorCode` is authored as `#RRGGBB` in the admin; anything unparseable
  /// falls back to the neutral fill so the chip never renders a black hole.
  Color get _swatchColor {
    final raw = option.colorCode.replaceAll('#', '').trim();
    if (raw.length != 6) return AppColors.subtle;
    final value = int.tryParse('FF$raw', radix: 16);
    return value == null ? AppColors.subtle : Color(value);
  }

  @override
  Widget build(BuildContext context) {
    final hasSwatch = option.colorCode.trim().isNotEmpty;

    return Opacity(
      opacity: option.soldOut ? 0.45 : 1,
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
              if (hasSwatch) ...[
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
              ],
              Text(
                option.value,
                style: TextStyle(
                  color: selected ? AppColors.brandGreen : AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (option.soldOut) ...[
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
