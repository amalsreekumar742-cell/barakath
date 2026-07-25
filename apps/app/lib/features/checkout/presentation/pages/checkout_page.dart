import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../address/domain/entities/address.dart';
import '../../../address/presentation/providers/address_provider.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../../../cart/presentation/widgets/price_summary.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../../domain/entities/place_order_result.dart';
import '../providers/checkout_provider.dart';

/// CheckoutPage (spec §2.13, §2.15).
///
/// Every figure shown here is a preview. `createPaymentOrder` recomputes the
/// bill server-side, debits the wallet atomically with order creation, and
/// returns the Razorpay order to charge — so the client can display a wrong
/// total but can never pay one.
class CheckoutPage extends StatefulWidget {
  const CheckoutPage({super.key});

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  late final Razorpay _razorpay;

  /// The order the Razorpay sheet is currently collecting for — needed by the
  /// success/failure handlers, which receive only Razorpay's own ids.
  PlaceOrderResult? _pending;
  bool _expandItems = false;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);

    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final addresses = context.read<AddressProvider>();
    final cart = context.read<CartProvider>();
    final settings = context.read<GeneralSettingsProvider>();

    cart.applySettings(
      slabs: settings.deliverySlabs,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      gstPercentage: settings.gstPercentage,
    );
    // Re-validate on entry: the bag may have been opened minutes ago and stock
    // moves. Placing an order on stale lines just fails server-side anyway.
    await cart.validateAndFetchPrices();
    await addresses.fetchAddresses();
    if (!mounted) return;
    context.read<CheckoutProvider>().preselectAddress(addresses.defaultAddress);
  }

  Future<void> _changeAddress() async {
    final picked =
        await context.push<Object?>('/saved-addresses?selectMode=true');
    if (!mounted || picked is! Address) return;
    context.read<CheckoutProvider>().selectAddress(picked);
  }

  Future<void> _placeOrder() async {
    final cart = context.read<CartProvider>();
    final checkout = context.read<CheckoutProvider>();
    final address = checkout.selectedAddress;

    if (address == null) {
      AppToast.error(context, 'Select a delivery address');
      return;
    }
    if (cart.items.isEmpty) {
      AppToast.error(context, 'Your bag is empty');
      return;
    }

    final result = await checkout.placeOrder(
      items: cart.items,
      addressId: address.id,
      couponCode: cart.appliedCoupon?.code ?? '',
    );
    if (!mounted) return;

    if (result == null) {
      AppToast.error(context, checkout.error ?? 'Could not place your order');
      return;
    }

    // Wallet covered the whole bill — the order is already paid, no sheet.
    if (result.isWalletOnly) {
      _finishSuccessfully(result.orderId);
      return;
    }

    _pending = result;
    _openRazorpay(result, cart);
  }

  void _openRazorpay(PlaceOrderResult order, CartProvider cart) {
    final user = context.read<AuthProvider>().currentUser;
    try {
      _razorpay.open({
        'key': order.keyId,
        // Razorpay works in paise; rounding avoids a floating-point 1-paisa
        // mismatch against the server-created order, which it would reject.
        'amount': (order.amount * 100).round(),
        'currency': 'INR',
        'name': AppDetails.appName,
        'description': 'Order payment',
        'order_id': order.razorpayOrderId,
        'prefill': {
          'contact': user?.phone ?? '',
          'email': user?.email ?? '',
        },
        'theme': {'color': '#0F7A5A'},
      });
    } catch (_) {
      AppToast.error(context, 'Could not open payment. Please try again.');
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    final checkout = context.read<CheckoutProvider>();
    final orderId = _pending?.orderId ?? '';

    final verified = await checkout.verifyPayment(
      razorpayOrderId: response.orderId ?? _pending?.razorpayOrderId ?? '',
      razorpayPaymentId: response.paymentId ?? '',
      razorpaySignature: response.signature ?? '',
    );
    if (!mounted) return;

    // Only the server's verdict counts — Razorpay's client callback alone isn't
    // proof of payment.
    if (verified != null && verified.verified) {
      _finishSuccessfully(verified.orderId.isEmpty ? orderId : verified.orderId);
      return;
    }
    context.go('/payment-failed?orderId=$orderId');
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    context.go('/payment-failed?orderId=${_pending?.orderId ?? ''}');
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    // The payment continues outside the app; the webhook settles the order, so
    // don't declare failure here.
    AppToast.info(context, 'Complete the payment in ${response.walletName ?? 'your wallet app'}');
  }

  void _finishSuccessfully(String orderId) {
    final cart = context.read<CartProvider>();
    cart.clearCart();
    cart.removeCoupon();
    context.read<CheckoutProvider>().reset();
    context.go('/order-success?orderId=$orderId');
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    final checkout = context.watch<CheckoutProvider>();
    final auth = context.watch<AuthProvider>();

    final walletBalance = auth.currentUser?.walletBalance ?? 0;
    final payable = (cart.grandTotal - checkout.walletAmountToUse)
        .clamp(0, double.infinity)
        .toDouble();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: 74,
        leading: Center(
          child: GestureDetector(
            onTap: () => context.pop(),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 42,
              height: 42,
              margin: const EdgeInsets.only(left: 20),
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
          'Checkout',
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
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: [
          _AddressSection(
            address: checkout.selectedAddress,
            onChange: _changeAddress,
            onAdd: () async {
              final added = await context.push<Object?>('/add-address');
              if (!context.mounted || added is! Address) return;
              context.read<CheckoutProvider>().selectAddress(added);
            },
          ),
          const SizedBox(height: 12),
          _DeliveryMethodCard(
            charge: cart.deliveryCharge,
            isFree: cart.hasFreeDelivery || cart.deliveryCharge <= 0,
          ),
          const SizedBox(height: 16),
          _ItemsSection(
            cart: cart,
            expanded: _expandItems,
            onToggle: () => setState(() => _expandItems = !_expandItems),
          ),
          const SizedBox(height: 16),
          const _PaymentMethodSection(),
          if (walletBalance > 0) ...[
            const SizedBox(height: 16),
            _WalletSection(
              balance: walletBalance,
              useWallet: checkout.useWallet,
              amountUsed: checkout.walletAmountToUse,
              coversAll: checkout.walletAmountToUse >= cart.grandTotal,
              onToggle: (use) => checkout.toggleWalletUsage(
                use: use,
                walletBalance: walletBalance,
                maxUsable: cart.grandTotal,
              ),
            ),
          ],
          const SizedBox(height: 16),
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
              walletDeduction: checkout.walletAmountToUse,
              total: payable,
              totalSavings: cart.totalSavings,
              totalLabel: 'To pay',
            ),
          ),
          if (payable <= 0 && checkout.walletAmountToUse > 0) ...[
            const SizedBox(height: 8),
            const Text(
              'Paid entirely from your wallet — no card payment needed.',
              style: TextStyle(fontSize: 12, color: AppColors.success),
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          decoration: const BoxDecoration(
            color: AppColors.surface,
            border: Border(top: BorderSide(color: AppColors.hairline)),
          ),
          // One full-width action carrying the amount, per the design — the
          // summary card directly above already breaks the total down.
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: checkout.isPlacingOrder ||
                      checkout.selectedAddress == null ||
                      cart.items.isEmpty
                  ? null
                  : _placeOrder,
              child: checkout.isPlacingOrder
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: AppColors.textPrimary),
                    )
                  : Text('Pay ₹${payable.toStringAsFixed(0)}'),
            ),
          ),
        ),
      ),
    );
  }
}

class _AddressSection extends StatelessWidget {
  const _AddressSection({
    required this.address,
    required this.onChange,
    required this.onAdd,
  });

  final Address? address;
  final VoidCallback onChange;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    if (address == null) {
      return GestureDetector(
        onTap: onAdd,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.hairline),
          ),
          child: const Row(
            children: [
              Icon(Icons.add_location_alt_outlined, color: AppColors.brandGreen),
              SizedBox(width: 12),
              Expanded(
                child: Text('Add a delivery address',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
              Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
            ],
          ),
        ),
      );
    }

    // Figma node 46:6784 — pin, "Label · City", the street line, and Change.
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.location_on_outlined,
              size: 20, color: AppColors.brandGreen),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${address!.label} · ${address!.city}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${address!.addressLine1}, ${address!.phone}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: onChange,
            behavior: HitTestBehavior.opaque,
            child: const Text(
              'Change',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.brandGreen,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemsSection extends StatelessWidget {
  const _ItemsSection({
    required this.cart,
    required this.expanded,
    required this.onToggle,
  });

  final CartProvider cart;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final items = cart.items;
    // Long bags collapse to three lines so the address and total stay reachable
    // without a long scroll.
    final visible = expanded ? items : items.take(3).toList();
    final hidden = items.length - visible.length;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Order summary (${items.length} item${items.length == 1 ? '' : 's'})',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          for (final item in visible) ...[
            Row(
              children: [
                CachedImage(
                  url: cart.variantFor(item)?.images.isNotEmpty == true
                      ? cart.variantFor(item)!.images.first
                      : item.productImage,
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.productName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        '${item.variantName} · Qty ${item.quantity}',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                Text(
                  '₹${((cart.variantFor(item)?.effectivePrice ?? 0) * item.quantity).toStringAsFixed(0)}',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ],
            ),
            const SizedBox(height: 10),
          ],
          if (hidden > 0 || expanded)
            GestureDetector(
              onTap: onToggle,
              behavior: HitTestBehavior.opaque,
              child: Text(
                expanded ? 'Show less' : 'and $hidden more item${hidden == 1 ? '' : 's'}',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brandGreen,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The delivery method row (Figma node 46:6784). The ETA line in the design is
/// deliberately NOT reproduced — nothing in the data models a delivery date, and
/// inventing "arrives tomorrow" would be a promise the store hasn't made.
class _DeliveryMethodCard extends StatelessWidget {
  const _DeliveryMethodCard({required this.charge, required this.isFree});

  final double charge;
  final bool isFree;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          const Icon(Icons.local_shipping_outlined,
              size: 20, color: AppColors.brandGreen),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              isFree
                  ? 'Standard · Free'
                  : 'Standard · ₹${charge.toStringAsFixed(0)}',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
          ),
          const Icon(Icons.check_rounded, size: 20, color: AppColors.brandGreen),
        ],
      ),
    );
  }
}

/// The design's "Payment method" block. Razorpay is the only option — the spec
/// removed cash on delivery — but it still earns its place: the customer knows
/// which sheet is about to open before they commit.
class _PaymentMethodSection extends StatelessWidget {
  const _PaymentMethodSection();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Payment method',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.brandGreen, width: 1.5),
          ),
          child: const Row(
            children: [
              Icon(Icons.credit_card_rounded,
                  size: 20, color: AppColors.brandGreen),
              SizedBox(width: 12),
              Expanded(
                child: Text('Card / UPI · Razorpay',
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              ),
              Icon(Icons.check_circle_rounded,
                  size: 22, color: AppColors.brandGreen),
            ],
          ),
        ),
      ],
    );
  }
}

class _WalletSection extends StatelessWidget {
  const _WalletSection({
    required this.balance,
    required this.useWallet,
    required this.amountUsed,
    required this.coversAll,
    required this.onToggle,
  });

  final double balance;
  final bool useWallet;
  final double amountUsed;
  final bool coversAll;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    // Gold-tinted card in the design — it reads as money, distinct from the
    // neutral address/payment rows above it.
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.cta.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cta.withValues(alpha: 0.55)),
      ),
      child: Column(
        children: [
          SwitchListTile.adaptive(
            value: useWallet,
            onChanged: onToggle,
            contentPadding: EdgeInsets.zero,
            secondary: const Icon(Icons.account_balance_wallet_outlined,
                color: AppColors.goldStrong),
            title: const Text('Use wallet balance',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            subtitle: Text(
              '₹${balance.toStringAsFixed(0)} available',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.goldStrong,
              ),
            ),
            activeThumbColor: Colors.white,
            activeTrackColor: AppColors.brandGreen,
          ),
          if (useWallet && amountUsed > 0)
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  coversAll
                      ? 'Entire order paid by wallet — no card payment needed'
                      : '₹${amountUsed.toStringAsFixed(0)} will be deducted from your wallet',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.success),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
