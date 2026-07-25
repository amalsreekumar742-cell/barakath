import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// The large tappable 1–5 star control: "How was it?" above, "Tap a star to
/// rate" below (design frame `Orders · Rate purchase`).
///
/// Half ratings are off on purpose — spec §2.24 and the `reviews` rule both say
/// an integer 1..5, and a 3.5 written from the app would be rejected by the
/// rating bound check on the way in.
class StarRatingInput extends StatelessWidget {
  const StarRatingInput({
    super.key,
    required this.rating,
    required this.onChanged,
    this.enabled = true,
  });

  final double rating;
  final ValueChanged<double> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          'How was it?',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppDimens.space10),
        RatingBar.builder(
          initialRating: rating,
          minRating: 1,
          allowHalfRating: false,
          glow: false,
          ignoreGestures: !enabled,
          itemCount: 5,
          itemSize: 40,
          unratedColor: AppColors.borderStrong,
          itemPadding: const EdgeInsets.symmetric(horizontal: AppDimens.space4),
          itemBuilder: (_, __) =>
              const Icon(Icons.star_rounded, color: AppColors.cta),
          onRatingUpdate: onChanged,
        ),
        const SizedBox(height: AppDimens.space10),
        const Text(
          'Tap a star to rate',
          style: TextStyle(fontSize: 12, color: AppColors.textFaint),
        ),
      ],
    );
  }
}
