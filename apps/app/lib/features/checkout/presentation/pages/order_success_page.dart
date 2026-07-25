import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../../../orders/presentation/widgets/order_format.dart';

/// OrderSuccessPage (spec §2.16).
///
/// PopScope blocks the back gesture: behind this page is checkout, and returning
/// there after a paid order invites a duplicate purchase.
class OrderSuccessPage extends StatefulWidget {
  const OrderSuccessPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderSuccessPage> createState() => _OrderSuccessPageState();
}

class _OrderSuccessPageState extends State<OrderSuccessPage> {
  @override
  void initState() {
    super.initState();
    // Belt and braces — checkout clears the bag, but if this page is ever
    // reached another way the paid-for items must not linger.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final cart = context.read<CartProvider>();
      if (cart.items.isNotEmpty) cart.clearCart();
    });
  }

  /// Delegates to the shared formatter so this screen and My Orders quote the
  /// SAME reference. They used to disagree: this one upper-cased the id, so a
  /// customer was shown `#P40LX3PE` here and `P40LX3PetY3v1wTxDA6I` in their
  /// order history — two strings for one order, neither matching the other.
  String get _reference => OrderFormat.referenceFromId(widget.orderId);

  @override
  Widget build(BuildContext context) {
    // Figma node 46:6972 — a green wash behind the tick, the message centred,
    // and the two actions pinned to the bottom.
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.center,
              colors: [Color(0xFFE7F1EC), AppColors.background],
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                children: [
                  const Spacer(flex: 3),
                  Container(
                    width: 96,
                    height: 96,
                    decoration: const BoxDecoration(
                      color: AppColors.brandGreen,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check_rounded,
                        size: 52, color: Colors.white),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Order placed',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(text: 'Nice — that\'s on its way! Order '),
                        TextSpan(
                          text: _reference,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const TextSpan(
                          text: ' is confirmed. We\'ll notify you when it ships.',
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.45,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const Spacer(flex: 4),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => context.go('/orders/${widget.orderId}'),
                      child: const Text('Track order'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => context.go('/home'),
                      child: const Text('Continue shopping'),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
