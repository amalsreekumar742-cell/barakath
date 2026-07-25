import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../../domain/entities/place_order_result.dart';
import '../providers/checkout_provider.dart';

/// PaymentFailedPage (spec §2.16).
///
/// Retry re-opens Razorpay against the ORDER THAT ALREADY EXISTS — it never
/// calls createPaymentOrder again, which would place a second order and reserve
/// stock twice.
class PaymentFailedPage extends StatefulWidget {
  const PaymentFailedPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<PaymentFailedPage> createState() => _PaymentFailedPageState();
}

class _PaymentFailedPageState extends State<PaymentFailedPage> {
  late final Razorpay _razorpay;
  bool _retrying = false;
  PlaceOrderResult? _pending;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  String get _shortId => widget.orderId.length > 8
      ? widget.orderId.substring(0, 8).toUpperCase()
      : widget.orderId.toUpperCase();

  Future<void> _retry() async {
    setState(() => _retrying = true);
    final checkout = context.read<CheckoutProvider>();
    final order = await checkout.loadOrderForRetry(widget.orderId);
    if (!mounted) return;
    setState(() => _retrying = false);

    if (order == null || order.razorpayOrderId == null || order.amount <= 0) {
      AppToast.error(context,checkout.error ?? 'This order can no longer be paid online');
      return;
    }

    _pending = order;
    final user = context.read<AuthProvider>().currentUser;
    // The key id comes from public settings — the order row doesn't carry it.
    final keyId = context.read<GeneralSettingsProvider>().settings.razorpayKeyId;
    if (keyId.isEmpty) {
      AppToast.error(context,'Payments are unavailable right now');
      return;
    }

    try {
      _razorpay.open({
        'key': keyId,
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
      AppToast.error(context,'Could not open payment. Please try again.');
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    final checkout = context.read<CheckoutProvider>();
    final verified = await checkout.verifyPayment(
      razorpayOrderId: response.orderId ?? _pending?.razorpayOrderId ?? '',
      razorpayPaymentId: response.paymentId ?? '',
      razorpaySignature: response.signature ?? '',
    );
    if (!mounted) return;

    if (verified != null && verified.verified) {
      context.go('/order-success?orderId=${widget.orderId}');
      return;
    }
    AppToast.error(context,'We couldn\'t confirm that payment');
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (mounted) AppToast.error(context,'Payment failed. You can try again.');
  }

  Future<void> _contactSupport() async {
    final phone = context.read<GeneralSettingsProvider>().helpPhone;
    if (phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close_rounded,
                    size: 52, color: AppColors.danger),
              ),
              const SizedBox(height: 24),
              const Text(
                'Payment failed',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Text(
                'Your payment for order #$_shortId could not be processed.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              const Text(
                'If any amount was deducted it will be refunded within 5–7 business days.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.muted),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _retrying ? null : _retry,
                  child: _retrying
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: AppColors.textPrimary),
                        )
                      : const Text('Retry payment'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => context.go('/home'),
                  child: const Text('Go to home'),
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _contactSupport,
                behavior: HitTestBehavior.opaque,
                child: const Text(
                  'Still stuck? Contact support',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.brandGreen,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
