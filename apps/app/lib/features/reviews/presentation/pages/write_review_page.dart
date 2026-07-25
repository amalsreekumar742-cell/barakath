import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/photo_upload_grid.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/reviews_provider.dart';
import '../widgets/review_product_header.dart';
import '../widgets/review_submitted_dialog.dart';
import '../widgets/star_rating_input.dart';

/// Rate your purchase — `/reviews/write/:orderId/:productId` (spec §2.24,
/// design frame `Orders · Rate purchase`).
///
/// Entered from Order Detail on a Delivered order. Star rating and review text
/// are both REQUIRED (the prototype marks the text "(optional)" — the spec wins;
/// see design map §4 row 3). Photos are optional, max 3. The review publishes
/// immediately and cannot be edited afterwards, so the submit goes through a
/// confirmation dialog.
class WriteReviewPage extends StatefulWidget {
  const WriteReviewPage({
    super.key,
    required this.orderId,
    required this.productId,
  });

  final String orderId;
  final String productId;

  @override
  State<WriteReviewPage> createState() => _WriteReviewPageState();
}

class _WriteReviewPageState extends State<WriteReviewPage> {
  final _textController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // After the first frame: `load` calls notifyListeners synchronously, which
    // is illegal while the tree is still building.
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _load() {
    if (!mounted) return;
    context.read<ReviewsProvider>().load(
          orderId: widget.orderId,
          productId: widget.productId,
          userId: context.read<AuthProvider>().currentUser?.id ?? '',
        );
  }

  /// Spec §2.25 — confirmation dialog before every action. Here it carries real
  /// information: the review is final once it lands.
  Future<bool> _confirm() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppDimens.radiusXl),
        ),
        title: const Text('Submit this review?'),
        content: const Text(
          'Your review is published straight away and cannot be edited or '
          'deleted afterwards.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  Future<void> _submit() async {
    final provider = context.read<ReviewsProvider>();
    if (!provider.canSubmit) return;

    // Both providers are read BEFORE the first await — reaching back through
    // `context` after one is what the async-gap lint is about.
    final user = context.read<AuthProvider>().currentUser;
    if (!await _confirm()) return;

    final outcome = await provider.submit(
      userId: user?.id ?? '',
      userName: user?.fullName ?? '',
      userImage: user?.profileImage ?? '',
    );
    if (!mounted) return;

    switch (outcome) {
      case SubmitReviewOutcome.success:
        AppToast.success(context, 'Thanks — your review is live.');
        await ReviewSubmittedDialog.show(context, rating: provider.rating);
        if (mounted) Navigator.of(context).pop(true);
      case SubmitReviewOutcome.duplicate:
        AppToast.error(context, 'You have already reviewed this product on this order.');
        Navigator.of(context).pop(false);
      case SubmitReviewOutcome.failure:
        AppToast.error(context, provider.submitError ?? 'Could not submit your review.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ReviewsProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Rate your purchase')),
      body: SafeArea(child: _body(provider)),
      bottomNavigationBar: provider.status == WriteReviewStatus.ready
          ? _bottomBar(provider)
          : null,
    );
  }

  Widget _body(ReviewsProvider provider) {
    switch (provider.status) {
      case WriteReviewStatus.initial:
      case WriteReviewStatus.loading:
        return const _WriteReviewSkeleton();

      case WriteReviewStatus.error:
        return ErrorState(
          message: provider.error ?? 'Could not load this purchase.',
          onRetry: _load,
        );

      case WriteReviewStatus.alreadyReviewed:
        // Empty/terminal states carry a message only — no action button
        // (spec §2.25).
        return const EmptyState(
          icon: Icons.rate_review_outlined,
          title: 'Already reviewed',
          subtitle: 'You have reviewed this product on this order. '
              'Reviews cannot be edited after submitting.',
        );

      case WriteReviewStatus.ready:
        return _form(provider);
    }
  }

  Widget _form(ReviewsProvider provider) {
    final item = provider.item!;
    final showTextError =
        provider.reviewText.isNotEmpty && !provider.isReviewTextValid;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space8,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        ReviewProductHeader(item: item),
        const SizedBox(height: AppDimens.space20),

        Padding(
          padding: const EdgeInsets.symmetric(vertical: AppDimens.space10),
          child: StarRatingInput(
            rating: provider.rating,
            enabled: !provider.isSubmitting,
            onChanged: provider.setRating,
          ),
        ),
        const SizedBox(height: AppDimens.space10),

        // Spec §2.24: the review text is REQUIRED, minimum 10 characters.
        const _FieldLabel('Write a review'),
        const SizedBox(height: AppDimens.space8),
        TextField(
          controller: _textController,
          onChanged: provider.setReviewText,
          enabled: !provider.isSubmitting,
          minLines: 4,
          maxLines: 8,
          maxLength: 1000,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(
            hintText: 'Share what you liked…',
            errorText: showTextError
                ? 'Please write at least '
                    '${ReviewsProvider.minReviewLength} characters.'
                : null,
            counterText: '',
          ),
        ),
        const SizedBox(height: AppDimens.space16),

        const _FieldLabel('Add photos', optional: true),
        const SizedBox(height: AppDimens.space8),
        PhotoUploadGrid(
          maxPhotos: ReviewsProvider.maxPhotos,
          initial: provider.photos,
          onChanged: (List<File> files) => provider.setPhotos(files),
        ),
        const SizedBox(height: AppDimens.space16),

        const Text(
          'Reviews are published immediately and cannot be edited after '
          'submitting.',
          style: TextStyle(
            fontSize: 12,
            height: 1.45,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _bottomBar(ReviewsProvider provider) {
    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space14,
        AppDimens.screenPadding,
        AppDimens.space16,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      child: SafeArea(
        top: false,
        child: CustomButton(
          label: 'Submit rating',
          isLoading: provider.isSubmitting,
          isDisabled: !provider.canSubmit,
          onPressed: _submit,
        ),
      ),
    );
  }
}

/// "Write a review" / "Add photos", with the design's muted "(optional)" suffix.
class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.label, {this.optional = false});

  final String label;
  final bool optional;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        text: label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
        children: [
          if (optional)
            const TextSpan(
              text: '  (optional)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textFaint,
              ),
            ),
        ],
      ),
    );
  }
}

/// Shimmer shaped like the real form (spec §2.25 — skeletons, never a bare
/// spinner).
class _WriteReviewSkeleton extends StatelessWidget {
  const _WriteReviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppDimens.screenPadding),
      children: const [
        ShimmerLoading(
          child: Row(
            children: [
              ShimmerBox(width: 56, height: 56, borderRadius: 8),
              SizedBox(width: AppDimens.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ShimmerBox(width: double.infinity, height: 14),
                    SizedBox(height: AppDimens.space8),
                    ShimmerBox(width: 120, height: 12),
                  ],
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: AppDimens.space24),
        ShimmerLoading(
          child: Center(child: ShimmerBox(width: 220, height: 40, borderRadius: 8)),
        ),
        SizedBox(height: AppDimens.space24),
        ShimmerLoading(
          child: ShimmerBox(width: double.infinity, height: 110, borderRadius: 8),
        ),
        SizedBox(height: AppDimens.space16),
        ShimmerLoading(
          child: ShimmerBox(width: 84, height: 84, borderRadius: 8),
        ),
      ],
    );
  }
}
