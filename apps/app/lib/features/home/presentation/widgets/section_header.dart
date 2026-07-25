import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

/// A home section title with an optional trailing chip (the flash-sale
/// countdown) and an optional "View All" action — the shape every section on
/// the home screen shares (design: 18px/800 title, 13px/700 green action).
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.trailing,
    this.onViewAll,
    this.actionLabel = 'See all',
  });

  final String title;

  /// Rendered right after the title (e.g. the flash-sale countdown chip).
  final Widget? trailing;

  final VoidCallback? onViewAll;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // WHY the title group is Expanded rather than `Flexible + Spacer`:
        // a Spacer is an Expanded, so the title and the spacer were equal-flex
        // siblings and each was ALLOCATED half the row. The title is loose, so
        // it shrank back to its text width — and the space it gave up was left
        // dangling at the end of the row instead of being absorbed. "See all"
        // therefore sat mid-row, and moved depending on how long the title was
        // ("Floral" and "Woody" put it in visibly different places).
        //
        // One Expanded that eats every spare pixel puts the action hard right,
        // at the same margin as the row of cards below it, for every title.
        Expanded(
          child: Row(
            children: [
              Flexible(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 10),
                trailing!,
              ],
            ],
          ),
        ),
        if (onViewAll != null)
          GestureDetector(
            onTap: onViewAll,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              // Left and vertical inset only. A horizontal inset would push
              // "See all" 4px in from the section margin, so it stopped lining
              // up with the right edge of the row/grid directly beneath it —
              // the design has both flush to the same margin
              // (align-items:center, justify-content:space-between).
              padding: const EdgeInsets.only(left: 12, top: 6, bottom: 6),
              child: Text(
                actionLabel,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brandGreen,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
