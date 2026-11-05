import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../products/presentation/widgets/product_detail_reviews_section.dart';
import '../../domain/entities/review.dart';
import '../providers/review_moderation_provider.dart';

/// Every published review of a product, newest first ("View All" on the product
/// page).
class ProductReviewsPage extends StatefulWidget {
  const ProductReviewsPage({super.key, required this.productId});

  final String productId;

  @override
  State<ProductReviewsPage> createState() => _ProductReviewsPageState();
}

class _ProductReviewsPageState extends State<ProductReviewsPage> {
  List<Review>? _reviews;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _reviews = null;
      _error = null;
    });
    try {
      final reviews = await context
          .read<ReviewModerationProvider>()
          .fetchProductReviews(widget.productId);
      if (mounted) setState(() => _reviews = reviews);
    } on ServerException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final moderation = context.watch<ReviewModerationProvider>();
    final reviews = _reviews;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Ratings & reviews')),
      body: SafeArea(
        child: Builder(
          builder: (_) {
            if (_error != null) {
              return ErrorState(message: _error!, onRetry: _load);
            }
            if (reviews == null) {
              return const Center(child: CircularProgressIndicator());
            }
            final visible = moderation.visible(reviews);
            if (visible.isEmpty) {
              return const EmptyState(
                icon: Icons.star_border,
                title: 'No reviews yet',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.all(AppDimens.screenPadding),
              itemCount: visible.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) =>
                  ProductDetailReviewCard(review: visible[i]),
            );
          },
        ),
      ),
    );
  }
}
