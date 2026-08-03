import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../../domain/entities/coupon.dart';
import '../../domain/entities/coupon_validation.dart';
import '../providers/coupon_provider.dart';

/// CouponSelectionPage — type a code or pick one off the list (spec §2.11).
///
/// Applying only sets local state; the discount is recomputed and re-validated
/// by `createPaymentOrder` before anything is charged.
class CouponSelectionPage extends StatefulWidget {
  const CouponSelectionPage({super.key});

  @override
  State<CouponSelectionPage> createState() => _CouponSelectionPageState();
}

class _CouponSelectionPageState extends State<CouponSelectionPage> {
  final _codeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => context.read<CouponProvider>().fetchCoupons(),
    );
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _applyTypedCode() async {
    final cart = context.read<CartProvider>();
    final coupons = context.read<CouponProvider>();

    final result = await coupons.validateCode(
      code: _codeController.text,
      subtotal: cart.subtotal,
      cartProducts: cart.cartProducts,
    );
    if (!mounted) return;

    if (!result.isValid) {
      AppToast.error(context, result.error ?? 'That coupon can\'t be used');
      return;
    }
    cart.applyCoupon(result.coupon!, result.discount);
    context.pop();
  }

  void _applyListed(Coupon coupon) {
    final cart = context.read<CartProvider>();
    final result = context.read<CouponProvider>().validate(
          coupon: coupon,
          subtotal: cart.subtotal,
          cartProducts: cart.cartProducts,
        );
    if (!result.isValid) {
      AppToast.error(context, result.error ?? 'That coupon can\'t be used');
      return;
    }
    cart.applyCoupon(coupon, result.discount);
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final coupons = context.watch<CouponProvider>();
    final cart = context.watch<CartProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: CircleBackButton.leadingWidth,
        leading: CircleBackButton.appBarLeading(fallbackRoute: '/checkout'),
        title: const Text(
          'Apply coupon',
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
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppDimens.screenPadding,
              12,
              AppDimens.screenPadding,
              8,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: CustomTextField(
                    controller: _codeController,
                    hint: 'Enter code',
                    textInputAction: TextInputAction.done,
                    inputFormatters: [UpperCaseFormatter()],
                  ),
                ),
                const SizedBox(width: 12),
                // Width is pinned: a button beside a field is laid out with an
                // unbounded width, so it must state its own.
                SizedBox(
                  width: 96,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: coupons.applyLoading ? null : _applyTypedCode,
                    child: coupons.applyLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Apply'),
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: _buildList(coupons, cart)),
        ],
      ),
    );
  }

  Widget _buildList(CouponProvider coupons, CartProvider cart) {
    if (coupons.isLoading) {
      return ShimmerLoading(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 4,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (_, __) => const ShimmerCard(height: 120),
        ),
      );
    }

    if (coupons.error != null) {
      return ErrorState(
        message: coupons.error!,
        onRetry: () => context.read<CouponProvider>().fetchCoupons(),
      );
    }

    final available = coupons.availableCoupons;
    final mine = coupons.myCoupons;

    if (available.isEmpty && mine.isEmpty) {
      return const EmptyState(
        icon: Icons.local_offer_outlined,
        title: 'No coupons available',
        subtitle: 'Check back later — offers appear here when they go live.',
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        8,
        AppDimens.screenPadding,
        24,
      ),
      children: [
        if (mine.isNotEmpty) ...[
          const _SectionLabel('From your spins'),
          for (final coupon in mine)
            _CouponCard(
              coupon: coupon,
              validation: coupons.validate(
                coupon: coupon,
                subtotal: cart.subtotal,
                cartProducts: cart.cartProducts,
              ),
              isApplied: cart.appliedCoupon?.code == coupon.code,
              onApply: () => _applyListed(coupon),
            ),
          const SizedBox(height: 8),
        ],
        if (available.isNotEmpty) ...[
          const _SectionLabel('Available for you'),
          for (final coupon in available)
            _CouponCard(
              coupon: coupon,
              validation: coupons.validate(
                coupon: coupon,
                subtotal: cart.subtotal,
                cartProducts: cart.cartProducts,
              ),
              isApplied: cart.appliedCoupon?.code == coupon.code,
              onApply: () => _applyListed(coupon),
            ),
        ],
      ],
    );
  }
}

/// Coupon codes are stored upper-case, so normalise as the customer types
/// rather than rejecting a lower-case entry.
class UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) =>
      TextEditingValue(
        text: newValue.text.toUpperCase(),
        selection: newValue.selection,
      );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 10),
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            color: AppColors.textFaint,
          ),
        ),
      );
}

class _CouponCard extends StatelessWidget {
  const _CouponCard({
    required this.coupon,
    required this.validation,
    required this.isApplied,
    required this.onApply,
  });

  final Coupon coupon;
  final CouponValidation validation;

  /// Re-opening this page with a coupon already on the cart must show which one
  /// it is, otherwise the customer can't tell whether their code stuck.
  final bool isApplied;
  final VoidCallback onApply;

  String get _offer => coupon.discountType.toLowerCase() == 'percentage'
      ? '${coupon.discountValue.toStringAsFixed(0)}% off'
      : '₹${coupon.discountValue.toStringAsFixed(0)} off';

  @override
  Widget build(BuildContext context) {
    final usable = validation.isValid;

    // Three states from the design: applied (gold tint + solid pill), available
    // (white, green offer, green "Apply"), and locked (muted with the reason in
    // red — disabled rather than hidden, because "Min order ₹500" is exactly
    // what tells the customer how to qualify).
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isApplied
            ? AppColors.cta.withValues(alpha: 0.10)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isApplied ? AppColors.cta : AppColors.hairline,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${coupon.code} · $_offer',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                    color: isApplied
                        ? AppColors.goldStrong
                        : (usable
                            ? AppColors.brandGreen
                            : AppColors.textFaint),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              if (isApplied)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.cta,
                    borderRadius: BorderRadius.circular(9999),
                  ),
                  child: const Text(
                    'Applied',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                )
              else if (usable)
                GestureDetector(
                  onTap: onApply,
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding:
                        EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                    child: Text(
                      'Apply',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.brandGreen,
                      ),
                    ),
                  ),
                )
              else
                const Text(
                  'Locked',
                  style: TextStyle(fontSize: 13, color: AppColors.textFaint),
                ),
            ],
          ),
          if (coupon.description.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              coupon.description,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _Meta(
                coupon.minimumOrderAmount > 0
                    ? 'Min order ₹${coupon.minimumOrderAmount.toStringAsFixed(0)}'
                    : 'No minimum',
              ),
              if (coupon.discountType.toLowerCase() == 'percentage' &&
                  coupon.maximumDiscount > 0)
                _Meta('Up to ₹${coupon.maximumDiscount.toStringAsFixed(0)}'),
              if (coupon.validUntil != null)
                _Meta('Valid until ${_date(coupon.validUntil!)}'),
            ],
          ),
          if (!usable && !isApplied && validation.error != null) ...[
            const SizedBox(height: 6),
            Text(
              validation.error!,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.statusError),
            ),
          ],
        ],
      ),
    );
  }

  String _date(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

class _Meta extends StatelessWidget {
  const _Meta(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(fontSize: 11, color: AppColors.muted),
      );
}
