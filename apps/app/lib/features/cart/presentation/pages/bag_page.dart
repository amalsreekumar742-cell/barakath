import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/login_prompt_sheet.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../providers/cart_provider.dart';
import '../widgets/cart_line_tile.dart';
import '../widgets/price_summary.dart';

/// BagPage — the cart tab (spec §2.10).
///
/// Prices are NEVER taken from the locally-persisted cart: on every open the
/// lines are re-read from Firestore, unavailable items are dropped and
/// over-stock quantities clamped, with a toast explaining each change.
class BagPage extends StatefulWidget {
  const BagPage({super.key});

  @override
  State<BagPage> createState() => _BagPageState();
}

class _BagPageState extends State<BagPage> {
  /// The line-up the currently loaded prices were fetched for. `null` until the
  /// first fetch, so an initial empty bag still counts as "not yet priced".
  String? _pricedSignature;

  // NOTE: no initState fetch. The signature check in build() covers the first
  // load too (`null` never equals a real signature), and doing it in both places
  // fired two identical fetches on every first open.

  Future<void> _refresh() async {
    if (!mounted) return;
    final cart = context.read<CartProvider>();
    final settings = context.read<GeneralSettingsProvider>();
    cart.applySettings(
      slabs: settings.deliverySlabs,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      gstPercentage: settings.gstPercentage,
    );
    await cart.validateAndFetchPrices();
    if (!mounted) return;
    for (final notice in cart.takeNotices()) {
      AppToast.info(context, notice);
    }
  }

  Future<void> _confirmRemove(
      String productId, String variantId, String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove item'),
        content: Text('Remove $name from your bag?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      context.read<CartProvider>().removeFromCart(productId, variantId);
    }
  }

  void _proceed() {
    if (!context.read<AuthProvider>().isAuthenticated) {
      showLoginPromptSheet(context);
      return;
    }
    context.push('/checkout');
  }

  /// Which LINES the loaded prices belong to. Quantity is deliberately excluded:
  /// changing it re-uses the variant we already hold and needs no second read.
  String _linesSignature(CartProvider cart) =>
      cart.items.map((i) => '${i.productId}/${i.variantId}').join('|');

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();

    // WHY this is not just initState: the Bag is a branch of a
    // StatefulShellRoute.indexedStack, so this State is built ONCE and kept
    // alive for the whole session. A customer who opens the Bag tab (even an
    // empty one), then adds a product, comes back to a page whose initState
    // already ran — `_details` still holds the previous fetch, every
    // `variantFor` returns null, and the bag renders Subtotal ₹0 / "Checkout ·
    // ₹0" with no error, because a missing price sums to zero rather than
    // failing. So re-fetch whenever the set of lines no longer matches what the
    // loaded prices were fetched for.
    final signature = _linesSignature(cart);
    if (signature != _pricedSignature && !cart.isValidating) {
      _pricedSignature = signature;
      WidgetsBinding.instance.addPostFrameCallback((_) => _refresh());
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      // Figma node 46:6449 — big title with the live count sitting beside it.
      appBar: AppBar(
        titleSpacing: 20,
        toolbarHeight: 60,
        title: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            const Text(
              'Your bag',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.48,
                color: AppColors.textPrimary,
              ),
            ),
            if (cart.items.isNotEmpty) ...[
              const SizedBox(width: 8),
              Text(
                '${cart.items.length} item${cart.items.length == 1 ? '' : 's'}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textFaint,
                ),
              ),
            ],
          ],
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: _buildBody(cart),
      bottomNavigationBar: cart.items.isEmpty || cart.isValidating
          ? null
          : _CheckoutBar(total: cart.grandTotal, onTap: _proceed),
    );
  }

  Widget _buildBody(CartProvider cart) {
    if (cart.isValidating) return const _BagShimmer();

    if (cart.validationError != null && cart.items.isNotEmpty) {
      return ErrorState(message: cart.validationError!, onRetry: _refresh);
    }

    if (cart.items.isEmpty) {
      return EmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'Your bag is empty',
        subtitle: 'Browse the store and add something you like.',
        actionLabel: 'Start shopping',
        onAction: () => context.go('/home'),
      );
    }

    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          12,
          AppDimens.screenPadding,
          24,
        ),
        children: [
          for (final item in cart.items) ...[
            Dismissible(
              key: ValueKey('${item.productId}_${item.variantId}'),
              direction: DismissDirection.endToStart,
              background: Container(
                alignment: Alignment.centerRight,
                padding: const EdgeInsets.only(right: 20),
                decoration: BoxDecoration(
                  color: AppColors.danger,
                  borderRadius: BorderRadius.circular(14),
                ),
                child:
                    const Icon(Icons.delete_outline_rounded, color: Colors.white),
              ),
              onDismissed: (_) {
                cart.removeFromCart(item.productId, item.variantId);
                AppToast.success(context, '${item.productName} removed');
              },
              child: CartLineTile(
                item: item,
                variant: cart.variantFor(item),
                onIncrement: () async {
                  final stock = cart.variantFor(item)?.stock ?? 0;
                  if (item.quantity >= stock) {
                    AppToast.error(context, 'Only $stock available');
                    return;
                  }
                  final ok = await cart.updateQuantity(
                      item.productId, item.variantId, item.quantity + 1);
                  if (!mounted || ok) return;
                  AppToast.error(context, 'Could not update quantity');
                },
                onDecrement: () async {
                  final ok = await cart.updateQuantity(
                      item.productId, item.variantId, item.quantity - 1);
                  if (!mounted || ok) return;
                  AppToast.error(context, 'Could not update quantity');
                },
                onDelete: () => _confirmRemove(
                    item.productId, item.variantId, item.productName),
              ),
            ),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 4),
          _CouponRow(
            code: cart.appliedCoupon?.code,
            discount: cart.couponDiscount,
            onTap: () => context.push('/coupons'),
            onRemove: cart.removeCoupon,
          ),
          const SizedBox(height: 16),
          // The design puts the summary on its own white card.
          Container(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.hairline),
            ),
            child: PriceSummary(
              subtotal: cart.subtotal,
              couponDiscount: cart.couponDiscount,
              deliveryCharge: cart.deliveryCharge,
              baseDeliveryCharge: cart.baseDeliveryCharge,
              hasFreeDelivery: cart.hasFreeDelivery,
              gstAmount: cart.gstAmount,
              total: cart.grandTotal,
              totalSavings: cart.totalSavings,
            ),
          ),
          if ((cart.largestComboCharge ?? 0) > 0) ...[
            const SizedBox(height: 8),
            Text(
              'Includes ₹${cart.largestComboCharge!.toStringAsFixed(0)} bundle delivery',
              style:
                  const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

/// The coupon entry point: a prompt when none is applied, the applied code with
/// a remove affordance when one is.
class _CouponRow extends StatelessWidget {
  const _CouponRow({
    required this.code,
    required this.discount,
    required this.onTap,
    required this.onRemove,
  });

  final String? code;
  final double discount;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final applied = code != null && code!.isNotEmpty;
    return GestureDetector(
      onTap: applied ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: applied ? AppColors.brandGreenSubtle : AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: applied ? AppColors.brandGreen : AppColors.hairline,
          ),
        ),
        child: Row(
          children: [
            Icon(
              applied
                  ? Icons.check_circle_rounded
                  : Icons.add_circle_outline_rounded,
              size: 20,
              color: AppColors.brandGreen,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                applied
                    ? '$code applied · ₹${discount.toStringAsFixed(0)} off'
                    : 'Apply a coupon',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: applied ? FontWeight.w700 : FontWeight.w600,
                  color: applied ? AppColors.brandGreen : AppColors.textPrimary,
                ),
              ),
            ),
            if (applied)
              GestureDetector(
                onTap: onRemove,
                behavior: HitTestBehavior.opaque,
                child: const Icon(Icons.close_rounded,
                    size: 18, color: AppColors.brandGreen),
              )
            else
              const Icon(Icons.arrow_forward_rounded,
                  size: 18, color: AppColors.textFaint),
          ],
        ),
      ),
    );
  }
}

class _CheckoutBar extends StatelessWidget {
  const _CheckoutBar({required this.total, required this.onTap});

  final double total;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // One full-width action carrying the amount, per the design — the total is
    // already stated on the summary card just above it.
    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          12,
          AppDimens.screenPadding,
          12,
        ),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.hairline)),
        ),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: onTap,
            child: Text('Checkout · ₹${total.toStringAsFixed(0)}'),
          ),
        ),
      ),
    );
  }
}

class _BagShimmer extends StatelessWidget {
  const _BagShimmer();

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          12,
          AppDimens.screenPadding,
          24,
        ),
        itemCount: 3,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, __) => const ShimmerCard(height: 104),
      ),
    );
  }
}
