import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/image_viewer.dart';
import '../../../reviews/domain/entities/review.dart';

/// The 5→1 star distribution bars beside the average (Figma node 46:6173).
class _RatingBars extends StatelessWidget {
  const _RatingBars({required this.breakdown});

  final Map<int, int> breakdown;

  @override
  Widget build(BuildContext context) {
    final highest = breakdown.values.fold<int>(0, (a, b) => a > b ? a : b);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var star = 5; star >= 1; star--)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 1.5),
            child: Row(
              children: [
                SizedBox(
                  width: 10,
                  child: Text(
                    '$star',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(9999),
                    child: LinearProgressIndicator(
                      // Guard the divide: with no reviews every bar is empty
                      // rather than NaN.
                      value: highest == 0
                          ? 0
                          : (breakdown[star] ?? 0) / highest,
                      minHeight: 5,
                      backgroundColor: AppColors.hairline,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        AppColors.cta,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The inline "Ratings & reviews" block: summary header, a View All link and up
/// to three of the most recent published reviews.
class ProductDetailReviewsSection extends StatelessWidget {
  const ProductDetailReviewsSection({
    super.key,
    required this.reviews,
    required this.averageRating,
    required this.totalReviews,
    required this.onViewAll,
    this.ratingBreakdown = const {},
  });

  final List<Review> reviews;
  final double averageRating;
  final int totalReviews;
  final VoidCallback onViewAll;

  /// Star → count over the reviews that were loaded, for the design's bars.
  final Map<int, int> ratingBreakdown;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Ratings & reviews',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (totalReviews > 0)
                GestureDetector(
                  onTap: onViewAll,
                  child: const Text(
                    'View All',
                    style: TextStyle(
                      color: AppColors.brandGreen,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (totalReviews > 0) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.hairline),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        averageRating.toStringAsFixed(1),
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      _Stars(rating: averageRating, size: 13),
                    ],
                  ),
                  const SizedBox(width: 18),
                  // The distribution bars from the design. Built from the
                  // reviews on this page — no server-side per-star aggregate
                  // exists — so the bars are relative to each other, not to
                  // the lifetime total.
                  Expanded(child: _RatingBars(breakdown: ratingBreakdown)),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (reviews.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: const Text(
                'No reviews yet. Be the first to review!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13.5,
                ),
              ),
            )
          else
            for (final review in reviews)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: ProductDetailReviewCard(review: review),
              ),
        ],
      ),
    );
  }
}

/// One review: author, date, stars, verified badge, title, truncated comment
/// with Read more, photo thumbnails and the admin's response when present.
class ProductDetailReviewCard extends StatefulWidget {
  const ProductDetailReviewCard({super.key, required this.review});

  final Review review;

  @override
  State<ProductDetailReviewCard> createState() =>
      _ProductDetailReviewCardState();
}

class _ProductDetailReviewCardState extends State<ProductDetailReviewCard> {
  static final DateFormat _dateFormat = DateFormat('d MMM yyyy');
  static const int _collapsedLines = 3;

  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final review = widget.review;
    // 3 short lines never overflow — only offer the toggle when it can matter.
    final canExpand = review.comment.length > 120;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  review.userName.isEmpty ? 'Customer' : review.userName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (review.createdAt != null)
                Text(
                  _dateFormat.format(review.createdAt!),
                  style: const TextStyle(
                    color: AppColors.textFaint,
                    fontSize: 11.5,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              _Stars(rating: review.rating, size: 13),
              if (review.isVerifiedPurchase) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandGreenSubtle,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'Verified Purchase',
                    style: TextStyle(
                      color: AppColors.brandGreen,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (review.title.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              review.title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          if (review.comment.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              review.comment,
              maxLines: _expanded ? null : _collapsedLines,
              overflow:
                  _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                height: 1.5,
              ),
            ),
            if (canExpand)
              GestureDetector(
                onTap: () => setState(() => _expanded = !_expanded),
                child: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    _expanded ? 'Read less' : 'Read more',
                    style: const TextStyle(
                      color: AppColors.brandGreen,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
          ],
          if (review.photos.isNotEmpty) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: review.photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => showImageViewer(
                    context,
                    images: review.photos,
                    initialIndex: i,
                  ),
                  child: CachedImage(
                    url: review.photos[i],
                    height: 56,
                    width: 56,
                    borderRadius: 10,
                  ),
                ),
              ),
            ),
          ],
          if (review.adminResponse.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.subtle,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Admin Response',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    review.adminResponse,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12.5,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Stars extends StatelessWidget {
  const _Stars({required this.rating, required this.size});

  final double rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    return RatingBarIndicator(
      rating: rating,
      itemCount: 5,
      itemSize: size,
      unratedColor: AppColors.border,
      itemBuilder: (_, __) => const Icon(
        Icons.star_rounded,
        color: AppColors.gold,
      ),
    );
  }
}
