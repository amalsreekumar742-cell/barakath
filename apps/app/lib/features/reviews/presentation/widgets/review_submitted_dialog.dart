import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';

/// The `Orders · Rating submitted` confirmation: tick, "Thank you!", the stars
/// the customer just gave, and a single "Done".
///
/// Dismissal is deliberately button-only (`barrierDismissible: false`) — the
/// caller pops the screen when it closes, and a stray barrier tap would leave
/// the customer on a form for a review that no longer accepts edits.
class ReviewSubmittedDialog extends StatelessWidget {
  const ReviewSubmittedDialog({super.key, required this.rating});

  final double rating;

  static Future<void> show(BuildContext context, {required double rating}) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ReviewSubmittedDialog(rating: rating),
    );
  }

  @override
  Widget build(BuildContext context) {
    final stars = rating.round().clamp(0, 5);

    return Dialog(
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.semanticSuccessSubtle,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_rounded,
                size: 34,
                color: AppColors.semanticSuccess,
              ),
            ),
            const SizedBox(height: AppDimens.space10),
            const Text(
              'Thank you!',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: AppDimens.space8),
            const Text(
              'Your rating has been submitted. It helps other shoppers '
              'choose better.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: AppDimens.space12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < 5; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Icon(
                      i < stars ? Icons.star_rounded : Icons.star_outline_rounded,
                      size: 22,
                      color: AppColors.cta,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: AppDimens.space16),
            CustomButton(
              label: 'Done',
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
