import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../../domain/entities/wallet_top_up_order.dart';
import '../../domain/entities/wallet_top_up_support.dart';
import '../providers/wallet_provider.dart';
import '../widgets/amount_quick_pills.dart';
import '../widgets/wallet_money.dart';

/// Add money to the Normal Wallet (spec §2.20, panel `Wallet · Add money`).
///
/// NO minimum and NO maximum from the product side — spec §2.20 says so
/// explicitly. The quick pills are shortcuts, not limits. The server applies its
/// own ₹1 floor and a ₹1,00,000 ceiling, which are blast-radius guards on a
/// typo rather than business rules, and reports them as plain messages.
///
/// FLOW (all three steps are server-authoritative):
///   1. `startTopUp` → the server opens a Razorpay order and records the amount.
///   2. this page opens the Razorpay sheet with that order id and amount.
///   3. `finishTopUp` → the server verifies the signature and credits.
///
/// This page owns the `razorpay_flutter` instance because the plugin is a native
/// singleton with callbacks and a `clear()` that must run on dispose — the same
/// arrangement as CheckoutPage. The balance is never written here; the wallet
/// streams `users/{uid}` and the credit arrives on its own.
class AddMoneyPage extends StatefulWidget {
  const AddMoneyPage({super.key});

  @override
  State<AddMoneyPage> createState() => _AddMoneyPageState();
}

class _AddMoneyPageState extends State<AddMoneyPage> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  late final Razorpay _razorpay;

  /// The top-up the sheet is currently collecting for. Razorpay's callbacks
  /// return only its own ids, so the order we started has to be held here.
  WalletTopUpOrder? _pending;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError)
      ..on(Razorpay.EVENT_EXTERNAL_WALLET, _onExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  double? get _amount {
    final raw = _controller.text.trim();
    if (raw.isEmpty) return null;
    final parsed = double.tryParse(raw);
    if (parsed == null || parsed <= 0) return null;
    return parsed;
  }

  bool get _paymentsEnabled {
    try {
      return context
          .watch<GeneralSettingsProvider>()
          .settings
          .walletPaymentsEnabled;
    } catch (_) {
      return false;
    }
  }

  void _selectPill(double value) {
    // Whole rupees — the pills are round numbers and a trailing ".0" in the
    // field reads like a typo.
    _controller.text = value.toStringAsFixed(0);
    _controller.selection =
        TextSelection.collapsed(offset: _controller.text.length);
    _focusNode.unfocus();
    setState(() {});
  }

  /// Spec §2.25: a confirmation dialog before every action that spends money.
  Future<bool> _confirm(double amount) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        ),
        title: const Text(
          'Add money?',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
        ),
        content: Text(
          '${WalletMoney.whole(amount)} will be added to your wallet after '
          'payment. Wallet money never expires and can be used at checkout.',
          style: const TextStyle(
            fontSize: 14,
            height: 1.45,
            color: AppColors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text('Add ${WalletMoney.whole(amount)}'),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  Future<void> _addMoney() async {
    final amount = _amount;
    if (amount == null) {
      AppToast.error(context, 'Enter an amount greater than ₹0.');
      return;
    }

    if (!await _confirm(amount)) return;
    if (!mounted) return;

    final wallet = context.read<WalletProvider>();
    final order = await wallet.startTopUp(amount);
    if (!mounted) return;

    if (order == null) {
      AppToast.error(context, wallet.error ?? 'Could not start the top-up. Please try again.');
      wallet.clearError();
      return;
    }

    _pending = order;
    _openRazorpay(order);
  }

  void _openRazorpay(WalletTopUpOrder order) {
    final user = context.read<AuthProvider>().currentUser;
    try {
      _razorpay.open({
        'key': order.keyId,
        // Paise, from the SERVER's amount. Razorpay rejects a sheet whose
        // amount differs from the order it was created against, so this must be
        // order.amount and never the value typed into the field.
        'amount': (order.amount * 100).round(),
        'currency': 'INR',
        'name': AppDetails.appName,
        'description': 'Wallet top-up',
        'order_id': order.razorpayOrderId,
        'prefill': {
          'contact': user?.phone ?? '',
          'email': user?.email ?? '',
        },
        'theme': {'color': '#0F7A5A'},
      });
    } catch (_) {
      context.read<WalletProvider>().cancelTopUp();
      AppToast.error(context, 'Could not open payment. Please try again.');
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    final wallet = context.read<WalletProvider>();

    // Razorpay's own callback is NOT proof of payment — only the server's
    // signature check is. Nothing is credited until finishTopUp returns an
    // amount. `response.orderId` is preferred over `_pending` for exactly the
    // reason below: _pending may be gone.
    final credited = await wallet.finishTopUp(
      razorpayOrderId: response.orderId ?? _pending?.razorpayOrderId ?? '',
      razorpayPaymentId: response.paymentId ?? '',
      razorpaySignature: response.signature ?? '',
    );
    if (!mounted) return;

    if (credited != null) {
      // The amount comes from the SERVER, not from `_pending`. Razorpay opens
      // its own Activity and Android can destroy the host app behind it —
      // observed on a real device — in which case this State is brand new and
      // `_pending` is null. Reading the amount locally printed "₹0 added".
      //
      // The balance is NOT set here — the users/{uid} stream reports the credit
      // as soon as the Cloud Function commits it.
      AppToast.success(context, '${WalletMoney.whole(credited)} added to your wallet.');
      _leave();
      return;
    }
    AppToast.error(context, wallet.error ?? 'Could not confirm the top-up.');
    wallet.clearError();
  }

  /// Back to the wallet.
  ///
  /// `pop()` alone is not enough: if the app was recreated while the Razorpay
  /// Activity was in front, GoRouter restores this location with nothing
  /// beneath it, and a pop on an unpoppable stack does nothing at all — leaving
  /// the customer sitting on the Add money form after a successful payment,
  /// with no confirmation that it worked.
  void _leave() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/wallet');
    }
  }

  void _onPaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    // Code 2 (BASE_REQUEST_ERROR) covers a user-cancelled sheet. Treat a cancel
    // as a cancel — an error toast for "I changed my mind" reads as a fault.
    final cancelled = response.code == Razorpay.PAYMENT_CANCELLED;
    context.read<WalletProvider>().cancelTopUp();
    if (!cancelled) AppToast.error(context, 'Payment failed. No money was taken.');
  }

  void _onExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    // The payment continues outside the app and we get no signature here, so
    // there is nothing to verify. Nothing is credited on this path; the balance
    // updates if and when the payment settles and the customer returns.
    context.read<WalletProvider>().cancelTopUp();
    AppToast.info(context, 'Complete the payment in your wallet app, then pull to refresh.');
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletProvider>();
    final paymentsEnabled = _paymentsEnabled;
    final canTopUp = paymentsEnabled && WalletTopUpSupport.isAvailable;
    final amount = _amount;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        titleSpacing: AppDimens.space14,
        leadingWidth: CircleBackButton.leadingWidth,
        leading: CircleBackButton.appBarLeading(fallbackRoute: '/wallet'),
        title: const Text(
          'Add money',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.space8,
          AppDimens.screenPadding,
          AppDimens.space24,
        ),
        children: [
          const Text(
            'Enter amount',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppDimens.space8),
          _AmountField(
            controller: _controller,
            focusNode: _focusNode,
            enabled: canTopUp,
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: AppDimens.space6),
          Text(
            // The current balance as a subtitle, so the customer can see what
            // they are topping up from without leaving the screen.
            'Wallet balance ${WalletMoney.format(wallet.balance)}',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: AppDimens.space16),
          AmountQuickPills(
            selected: amount,
            onSelected: canTopUp ? _selectPill : (_) {},
          ),
          const SizedBox(height: AppDimens.gapSections),
          const _InfoBar(
            // Verbatim from the design panel — and true of the deployed schema:
            // `walletTransactions` create is admin-only in firestore.rules.
            message: 'Only UPI top-ups and admin credits can add money — the '
                'wallet can\'t be loaded any other way.',
          ),
          if (!canTopUp) ...[
            const SizedBox(height: AppDimens.gapCards),
            _InfoBar(
              tone: _InfoTone.warning,
              message: paymentsEnabled
                  ? WalletTopUpSupport.unavailableMessage
                  : 'Wallet payments are currently switched off by the store. '
                      'Your balance is safe and never expires.',
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
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
            label: amount == null
                ? 'Add money'
                : 'Add ${WalletMoney.whole(amount)}',
            isLoading: wallet.isToppingUp,
            isDisabled: !canTopUp || amount == null,
            onPressed: _addMoney,
          ),
        ),
      ),
    );
  }
}

/// The amount input: a 2px brand-green box with a ₹ prefix and a 26/800 value,
/// exactly the `Wallet · Add money` panel. Digits only — a decimal top-up isn't
/// a thing a customer wants to type on a phone keypad.
class _AmountField extends StatelessWidget {
  const _AmountField({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onChanged,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const valueStyle = TextStyle(
      fontSize: 26,
      fontWeight: FontWeight.w800,
      color: AppColors.textPrimary,
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
        border: Border.all(
          color: enabled ? AppColors.brandGreen : AppColors.borderStrong,
          width: 2,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Text('₹', style: valueStyle),
          const SizedBox(width: AppDimens.space8),
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              enabled: enabled,
              onChanged: onChanged,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: false,
                signed: false,
              ),
              // No min/max (spec §2.20) — the only constraint is that what is
              // typed is a positive whole number of rupees.
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(7),
              ],
              style: valueStyle,
              cursorColor: AppColors.brandGreen,
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                contentPadding: EdgeInsets.zero,
                hintText: '0',
                hintStyle: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textFaint,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

enum _InfoTone { info, warning }

/// The design system's soft InfoBar: a tinted rounded strip with an icon.
class _InfoBar extends StatelessWidget {
  const _InfoBar({required this.message, this.tone = _InfoTone.info});

  final String message;
  final _InfoTone tone;

  @override
  Widget build(BuildContext context) {
    final isWarning = tone == _InfoTone.warning;
    return Container(
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: isWarning
            ? AppColors.goldSubtle
            : AppColors.brandGreenSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(
          color: isWarning ? AppColors.goldBorder : AppColors.brandGreenSubtle,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isWarning
                ? Icons.info_outline_rounded
                : Icons.lock_outline_rounded,
            size: 18,
            color: isWarning ? AppColors.goldBadgeText : AppColors.brandGreen,
          ),
          const SizedBox(width: AppDimens.space10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 12,
                height: 1.45,
                color: isWarning
                    ? AppColors.goldBadgeText
                    : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
