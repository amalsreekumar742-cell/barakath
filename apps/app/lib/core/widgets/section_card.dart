import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';

/// The white panel every detail screen is built from: 12px radius, 1px hairline
/// border, flat (the design uses borders, not shadows, for content).
///
/// Optional [title] with an optional [action] on the right — the "Order summary
/// / View breakup" pattern that repeats across orders, wallet and affiliate.
class SectionCard extends StatelessWidget {
  const SectionCard({
    super.key,
    required this.child,
    this.title,
    this.action,
    this.padding,
    this.margin,
  });

  final Widget child;
  final String? title;

  /// Trailing widget in the title row — usually a TextButton or an icon.
  /// Ignored when [title] is null, since there would be no row to put it in.
  final Widget? action;

  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: margin,
      padding: padding ?? const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title != null) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    title!,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                if (action != null) action!,
              ],
            ),
            const SizedBox(height: AppDimens.space10),
          ],
          child,
        ],
      ),
    );
  }
}
