import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';

/// What the user applied in the filter sheet. All fields nullable — null means
/// "no constraint", which is exactly what the provider expects.
class ProductFilterResult {
  const ProductFilterResult({
    this.subCategory,
    this.priceMin,
    this.priceMax,
    this.minRating,
  });

  final String? subCategory;
  final double? priceMin;
  final double? priceMax;
  final double? minRating;
}

/// Filter sheet for the product listing (spec §2.9, Figma node 50:8713): a
/// price range slider, a single-select type, and a minimum rating.
///
/// Returns a [ProductFilterResult] through `Navigator.pop` (null when
/// dismissed); the caller applies it, so the sheet holds no provider knowledge.
///
/// NOTE: price and rating are applied CLIENT-SIDE by the provider —
/// `offerPrice` lives on the `variants` subcollection and Firestore cannot
/// filter a parent query on a child field, and a second range filter isn't
/// allowed alongside the sort field.
class FilterBottomSheet extends StatefulWidget {
  const FilterBottomSheet({
    super.key,
    required this.subCategories,
    this.selectedSubCategory,
    this.priceMin,
    this.priceMax,
    this.minRating,
    this.priceCeiling = 5000,
  });

  /// Sub-category names of the current category. Empty when the listing isn't
  /// scoped to a category — the chip section is then hidden.
  final List<String> subCategories;
  final String? selectedSubCategory;
  final double? priceMin;
  final double? priceMax;
  final double? minRating;

  /// Upper bound of the slider. Passed in so the range covers the catalogue
  /// actually on screen rather than a hardcoded guess.
  final double priceCeiling;

  static Future<ProductFilterResult?> show(
    BuildContext context, {
    required List<String> subCategories,
    String? selectedSubCategory,
    double? priceMin,
    double? priceMax,
    double? minRating,
    double priceCeiling = 5000,
  }) {
    return showModalBottomSheet<ProductFilterResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => FilterBottomSheet(
        subCategories: subCategories,
        selectedSubCategory: selectedSubCategory,
        priceMin: priceMin,
        priceMax: priceMax,
        minRating: minRating,
        priceCeiling: priceCeiling,
      ),
    );
  }

  @override
  State<FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends State<FilterBottomSheet> {
  late RangeValues _range;
  String? _subCategory;
  double? _minRating;

  double get _ceiling => widget.priceCeiling <= 0 ? 5000 : widget.priceCeiling;

  @override
  void initState() {
    super.initState();
    _range = RangeValues(
      (widget.priceMin ?? 0).clamp(0, _ceiling).toDouble(),
      (widget.priceMax ?? _ceiling).clamp(0, _ceiling).toDouble(),
    );
    _subCategory = widget.selectedSubCategory;
    _minRating = widget.minRating;
  }

  void _reset() {
    setState(() {
      _range = RangeValues(0, _ceiling);
      _subCategory = null;
      _minRating = null;
    });
  }

  void _apply() {
    // A full-width range means "no price constraint" — sending 0..ceiling would
    // pointlessly filter out anything priced above the slider's top stop.
    final atFullWidth = _range.start <= 0 && _range.end >= _ceiling;
    Navigator.of(context).pop(
      ProductFilterResult(
        subCategory: _subCategory,
        priceMin: atFullWidth ? null : _range.start,
        priceMax: atFullWidth ? null : _range.end,
        minRating: _minRating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.screenPadding,
            0,
            AppDimens.screenPadding,
            20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.hairline,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Filters',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: _reset,
                    behavior: HitTestBehavior.opaque,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                      child: Text(
                        'Reset',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textFaint,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              const _SectionLabel('Price range'),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 3,
                  activeTrackColor: AppColors.brandGreen,
                  inactiveTrackColor: AppColors.hairline,
                  thumbColor: AppColors.surface,
                  overlayColor: AppColors.brandGreen.withValues(alpha: 0.12),
                  rangeThumbShape: const RoundRangeSliderThumbShape(
                    enabledThumbRadius: 10,
                  ),
                ),
                child: RangeSlider(
                  values: _range,
                  min: 0,
                  max: _ceiling,
                  onChanged: (value) => setState(() => _range = value),
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('₹${_range.start.toStringAsFixed(0)}',
                      style: _priceStyle),
                  Text('₹${_range.end.toStringAsFixed(0)}', style: _priceStyle),
                ],
              ),
              if (widget.subCategories.isNotEmpty) ...[
                const SizedBox(height: 20),
                const _SectionLabel('Type'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    for (final name in widget.subCategories)
                      _Chip(
                        label: name,
                        active: _subCategory == name,
                        // Single-select: tapping the active chip clears it.
                        onTap: () => setState(
                          () => _subCategory = _subCategory == name ? null : name,
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 20),
              const _SectionLabel('Rating'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final value in const [4.5, 4.0, 3.0])
                    _Chip(
                      label: '$value & up',
                      icon: Icons.star_rounded,
                      active: _minRating == value,
                      gold: true,
                      onTap: () => setState(
                        () => _minRating = _minRating == value ? null : value,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: CustomButton(
                      label: 'Clear',
                      variant: ButtonVariant.outline,
                      onPressed: _reset,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: CustomButton(
                      label: 'Show results',
                      onPressed: _apply,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static const TextStyle _priceStyle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: AppColors.goldStrong,
  );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    );
  }
}

/// A filter pill. Type chips fill green when active; rating chips use the gold
/// tint the design gives them, so the two groups stay visually distinct.
class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.active,
    required this.onTap,
    this.icon,
    this.gold = false,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final IconData? icon;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final Color background;
    final Color border;
    final Color foreground;
    if (!active) {
      background = AppColors.surface;
      border = AppColors.hairline;
      foreground = AppColors.textPrimary;
    } else if (gold) {
      background = AppColors.cta.withValues(alpha: 0.14);
      border = AppColors.cta;
      foreground = AppColors.goldStrong;
    } else {
      background = AppColors.brandGreen;
      border = AppColors.brandGreen;
      foreground = Colors.white;
    }

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(color: border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: foreground),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: foreground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
