import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/photo_upload_grid.dart';
import '../../../../core/widgets/section_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../orders/domain/entities/order.dart';
import '../../../orders/presentation/providers/order_detail_provider.dart';
import '../providers/replacement_provider.dart';

/// Request Replacement (spec §2.18).
///
/// FOUR reason options, not the prototype's three — design map §4 conflict 4;
/// the spec wins ("Quality not as expected" is the one the prototype drops).
class RequestReplacementPage extends StatefulWidget {
  const RequestReplacementPage({
    super.key,
    required this.orderId,
    required this.productId,
    required this.variantId,
  });

  final String orderId;
  final String productId;
  final String variantId;

  @override
  State<RequestReplacementPage> createState() => _RequestReplacementPageState();
}

class _RequestReplacementPageState extends State<RequestReplacementPage> {
  final _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // The provider is app-wide: clear the previous request's answers so they
      // cannot bleed into this one.
      context.read<ReplacementProvider>().reset();
      context
          .read<OrderDetailProvider>()
          .load(widget.orderId, force: false);
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  OrderItem? _itemFor(Order order) {
    for (final item in order.items) {
      if (item.productId == widget.productId &&
          item.variantId == widget.variantId) {
        return item;
      }
    }
    return null;
  }

  Future<void> _submit(Order order, OrderItem item) async {
    final provider = context.read<ReplacementProvider>();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Submit this request?'),
        content: Text(
          'We will review your photos for ${item.productName} and get back to you.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final error = await provider.submit(
      orderId: order.id,
      userName: order.userName,
      userPhone: order.userPhone,
      userEmail: order.userEmail,
      productId: item.productId,
      productName: item.productName,
      productImage: item.productImage,
      variantId: item.variantId,
      variantName: item.variantName,
      variantColor: item.variantColor,
      quantity: item.quantity,
    );
    if (!mounted) return;

    if (error != null) {
      AppToast.error(context, error);
      return;
    }

    final reference = provider.submitted?.requestId ?? '';
    AppToast.success(
      context,
      reference.isEmpty
          ? 'Return request submitted'
          : 'Return request $reference submitted',
    );
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/orders/${order.id}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final orderProvider = context.watch<OrderDetailProvider>();
    final form = context.watch<ReplacementProvider>();

    final order = orderProvider.order?.id == widget.orderId
        ? orderProvider.order
        : null;
    final item = order == null ? null : _itemFor(order);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: 74,
        leading: Center(
          child: GestureDetector(
            onTap: () => context.canPop()
                ? context.pop()
                : context.go('/orders/${widget.orderId}'),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 42,
              height: 42,
              margin: const EdgeInsets.only(left: AppDimens.screenPadding),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.hairline),
              ),
              child: const Icon(Icons.arrow_back_rounded,
                  size: 20, color: AppColors.textPrimary),
            ),
          ),
        ),
        title: const Text(
          'Request replacement',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      bottomNavigationBar: item == null
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(
                  AppDimens.screenPadding,
                  15,
                  AppDimens.screenPadding,
                  AppDimens.space16,
                ),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(top: BorderSide(color: AppColors.hairline)),
                ),
                child: CustomButton(
                  label: 'Submit request',
                  isLoading: form.isSubmitting,
                  isDisabled: !form.canSubmit,
                  onPressed: () => _submit(order!, item),
                ),
              ),
            ),
      body: _body(orderProvider, form, order, item),
    );
  }

  Widget _body(
    OrderDetailProvider orderProvider,
    ReplacementProvider form,
    Order? order,
    OrderItem? item,
  ) {
    if (orderProvider.state == OrderDetailState.error) {
      return ErrorState(
        message: orderProvider.error ?? 'Could not load this order.',
        onRetry: () =>
            context.read<OrderDetailProvider>().load(widget.orderId),
      );
    }
    if (order == null) return const _ReplacementSkeleton();
    if (item == null) {
      return const ErrorState(
        message: 'That item is not part of this order.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        _productHeader(item),
        const SizedBox(height: AppDimens.gapCards),
        _reasons(form),
        const SizedBox(height: AppDimens.gapCards),
        _description(form),
        const SizedBox(height: AppDimens.gapCards),
        _photos(form),
        const SizedBox(height: AppDimens.gapCards),
        _infoBanner(),
      ],
    );
  }

  Widget _productHeader(OrderItem item) {
    return SectionCard(
      child: Row(
        children: [
          Container(
            width: AppDimens.tileThumb,
            height: AppDimens.tileThumb,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: AppColors.surfaceSubtle,
              borderRadius: BorderRadius.circular(AppDimens.radiusMd),
              border: Border.all(color: AppColors.hairline),
            ),
            child: CachedImage(url: item.productImage, fit: BoxFit.cover),
          ),
          const SizedBox(width: AppDimens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.productName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    if (item.variantName.isNotEmpty) item.variantName,
                    if (item.variantColor.isNotEmpty) item.variantColor,
                    'Qty ${item.quantity}',
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _reasons(ReplacementProvider form) {
    return SectionCard(
      title: 'Reason for return',
      child: Column(
        children: [
          // Hand-rolled radio rows rather than RadioListTile: the Material
          // widget now requires a RadioGroup ancestor (its `groupValue`/
          // `onChanged` are deprecated), and this matches the design's row
          // metrics exactly.
          for (final reason in ReplacementReason.values)
            _reasonRow(reason, form.reason == reason),
        ],
      ),
    );
  }

  Widget _reasonRow(ReplacementReason reason, bool selected) {
    return GestureDetector(
      onTap: () => context.read<ReplacementProvider>().selectReason(reason),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppDimens.space10),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: selected
                      ? AppColors.brandGreen
                      : AppColors.borderStrong,
                  width: 2,
                ),
              ),
              child: selected
                  ? Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: AppColors.brandGreen,
                        shape: BoxShape.circle,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: Text(
                reason.label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _description(ReplacementProvider form) {
    final remaining =
        ReplacementProvider.minDescriptionLength - form.description.trim().length;

    return SectionCard(
      title: 'Describe the issue *',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CustomTextField(
            controller: _descriptionController,
            hint: 'Tell us what went wrong…',
            maxLines: 4,
            maxLength: 500,
            onChanged: (value) =>
                context.read<ReplacementProvider>().setDescription(value),
          ),
          if (remaining > 0)
            Text(
              '$remaining more character(s) needed',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textFaint,
              ),
            ),
        ],
      ),
    );
  }

  Widget _photos(ReplacementProvider form) {
    return SectionCard(
      title: 'Upload photos *',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PhotoUploadGrid(
            maxPhotos: ReplacementProvider.maxPhotos,
            onChanged: (files) =>
                context.read<ReplacementProvider>().setPhotos(files),
          ),
          const SizedBox(height: AppDimens.space8),
          Text(
            form.hasPhotos
                ? '${form.photos.length} of ${ReplacementProvider.maxPhotos} photos added'
                : 'At least 1 photo of the product is required.',
            style: TextStyle(
              fontSize: 12,
              color: form.hasPhotos
                  ? AppColors.textSecondary
                  : AppColors.statusError,
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoBanner() {
    return Container(
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.brandGreenSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded,
              size: 18, color: AppColors.brandGreen),
          SizedBox(width: AppDimens.space10),
          Expanded(
            child: Text(
              'Approved requests get a free replacement shipped within 24 hours',
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                fontWeight: FontWeight.w600,
                color: AppColors.brandGreen,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReplacementSkeleton extends StatelessWidget {
  const _ReplacementSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: const [
        ShimmerCard(height: 60),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 140),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 100),
      ],
    );
  }
}
