import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../domain/repositories/product_repository.dart';

/// Sort picker for the product listing (spec §2.9).
///
/// Returns the chosen [ProductSort] through `Navigator.pop` (null when
/// dismissed) — the caller decides what to do with it, so the sheet stays free
/// of provider knowledge.
class SortBottomSheet extends StatelessWidget {
  const SortBottomSheet({super.key, required this.current});

  final ProductSort current;

  static Future<ProductSort?> show(BuildContext context, ProductSort current) {
    return showModalBottomSheet<ProductSort>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SortBottomSheet(current: current),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Grabber(),
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppDimens.screenPadding,
              4,
              AppDimens.screenPadding,
              8,
            ),
            child: Text(
              'Sort By',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          RadioGroup<ProductSort>(
            groupValue: current,
            onChanged: (value) => Navigator.of(context).pop(value),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final sort in ProductSort.values)
                  RadioListTile<ProductSort>(
                    value: sort,
                    activeColor: AppColors.brandGreen,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                    title: Text(
                      sort.label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: sort == current ? FontWeight.w700 : FontWeight.w500,
                        color: sort == current ? AppColors.brandGreen : AppColors.textPrimary,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _Grabber extends StatelessWidget {
  const _Grabber();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 40,
        height: 4,
        margin: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
