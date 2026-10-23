import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../domain/entities/variant_option.dart';
// The contract's own `VariantOption` (one unit of a variant) would clash with
// the chip model above; only the axis row type is needed from it.
import '../../domain/entities/variant_options.dart' show VariantAxis;

/// Independent selection rows — Colour, then one per unit group the product
/// varies on (Size, and e.g. Layer on a multi-axis cap) — instead of one
/// combined variant chip. A single-axis product gets Colour + Size, as always.
///
/// WHY the rows are rendered separately but resolved together: a variant is a
/// combination of every axis and the catalogue's combinations are sparse, so
/// the provider decides which variant a tap lands on (see its "Variant axes"
/// note). This widget stays dumb: it draws chips and reports which value was
/// tapped.
///
/// Unavailable values stay tappable on purpose — the shopper gets an explicit
/// "out of stock" message and a page that reflects it, instead of a dead chip
/// that seems broken. A greyed chip without the "Out of stock" tag is a value
/// that exists, just not with the current picks; the tag means it is sold out
/// everywhere. A row with no values is omitted entirely rather than rendering
/// a header over nothing.
class ProductDetailVariantSelector extends StatelessWidget {
  const ProductDetailVariantSelector({
    super.key,
    required this.colorOptions,
    required this.selectedColor,
    required this.onSelectColor,
    required this.axes,
    required this.selectedValue,
    required this.isAvailable,
    required this.isSoldOut,
    required this.onSelectAxis,
  });

  final List<VariantOption> colorOptions;
  final String selectedColor;
  final ValueChanged<String> onSelectColor;

  /// The non-colour rows, each labelled by its axis name ("Size", "Layer").
  final List<VariantAxis> axes;
  final String? Function(String axis) selectedValue;
  final bool Function(String axis, String value) isAvailable;
  final bool Function(String axis, String value) isSoldOut;
  final void Function(String axis, String value) onSelectAxis;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[
      if (colorOptions.isNotEmpty)
        _AxisRow(
          label: 'Colour',
          selected: selectedColor,
          chips: [
            for (final option in colorOptions)
              _ChipSpec(
                value: option.value,
                colorCode: option.colorCode,
                dimmed: option.soldOut,
                soldOut: option.soldOut,
              ),
          ],
          onSelect: onSelectColor,
        ),
      for (final axis in axes)
        _AxisRow(
          label: axis.axis,
          selected: selectedValue(axis.axis) ?? '',
          chips: [
            for (final value in axis.values)
              _ChipSpec(
                value: value,
                colorCode: '',
                dimmed: !isAvailable(axis.axis, value),
                soldOut: isSoldOut(axis.axis, value),
              ),
          ],
          onSelect: (value) => onSelectAxis(axis.axis, value),
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

/// What one chip draws — flattened so the colour row (swatches, from
/// [VariantOption]) and the unit rows (plain values) share a single chip.
class _ChipSpec {
  const _ChipSpec({
    required this.value,
    required this.colorCode,
    required this.dimmed,
    required this.soldOut,
  });

  final String value;

  /// `#RRGGBB` swatch for a colour chip; empty on a unit chip.
  final String colorCode;

  /// Greyed: no buyable variant with this value and the current picks.
  final bool dimmed;

  /// Tagged "Out of stock": every variant carrying this value is sold out.
  final bool soldOut;
}

class _AxisRow extends StatelessWidget {
  const _AxisRow({
    required this.label,
    required this.selected,
    required this.chips,
    required this.onSelect,
  });

  final String label;
  final String selected;
  final List<_ChipSpec> chips;
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
            itemCount: chips.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (_, i) {
              final chip = chips[i];
              return _OptionChip(
                chip: chip,
                selected: chip.value == selected,
                onTap: () => onSelect(chip.value),
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
    required this.chip,
    required this.selected,
    required this.onTap,
  });

  final _ChipSpec chip;
  final bool selected;
  final VoidCallback onTap;

  /// `colorCode` is authored as `#RRGGBB` in the admin; anything unparseable
  /// falls back to the neutral fill so the chip never renders a black hole.
  Color get _swatchColor {
    final raw = chip.colorCode.replaceAll('#', '').trim();
    if (raw.length != 6) return AppColors.subtle;
    final value = int.tryParse('FF$raw', radix: 16);
    return value == null ? AppColors.subtle : Color(value);
  }

  @override
  Widget build(BuildContext context) {
    final hasSwatch = chip.colorCode.trim().isNotEmpty;

    return Opacity(
      opacity: chip.dimmed ? 0.45 : 1,
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
                chip.value,
                style: TextStyle(
                  color: selected ? AppColors.brandGreen : AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (chip.soldOut) ...[
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
