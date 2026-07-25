import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/key_value_row.dart';
import '../../../../core/widgets/section_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../domain/entities/bank_account.dart';
import '../providers/affiliate_provider.dart';
import '../widgets/affiliate_format.dart';
import '../widgets/affiliate_scaffold.dart';
import '../widgets/affiliate_stat_cards.dart';
import '../widgets/bank_account_card.dart';

/// Complete withdrawal (spec §2.22, design frames "29 · Referral & withdraw"
/// and "39 · Complete withdrawal").
///
/// The app only FILES the request — admin approves it and transfers the money
/// outside the system, so nothing here writes `affiliateBalance` and no payout
/// SLA is printed (design map §4 row 9).
class WithdrawPage extends StatefulWidget {
  const WithdrawPage({super.key});

  @override
  State<WithdrawPage> createState() => _WithdrawPageState();
}

class _WithdrawPageState extends State<WithdrawPage> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();

  String? _selectedAccountId;
  String? _accountError;

  /// Spec §2.22 quick pills. ₹1,000 and ₹5,000 sit BELOW the ₹10,000 minimum on
  /// purpose — they are in the spec, so they stay, and validation rejects them
  /// with the reason rather than the screen pretending they don't exist.
  static const List<double> _quickAmounts = [1000, 5000];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAccounts());
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadAccounts() async {
    final uid = context.read<AuthProvider>().currentUser?.id;
    if (uid == null || !mounted) return;
    await context.read<AffiliateProvider>().loadBankAccounts(uid);
    if (!mounted) return;
    final accounts = context.read<AffiliateProvider>().bankAccounts;
    if (accounts.length == 1) {
      setState(() => _selectedAccountId = accounts.first.id);
    }
  }

  double get _amount =>
      double.tryParse(_amountController.text.replaceAll(RegExp(r'[^0-9.]'), '')) ??
      0;

  String? _validateAmount(double balance) {
    final raw = _amountController.text.trim();
    if (raw.isEmpty) return 'Enter an amount to withdraw.';
    final value = _amount;
    if (value <= 0) return 'Enter a valid amount.';
    if (value < AffiliateProvider.minWithdrawalAmount) {
      return 'The minimum withdrawal is '
          '${AffiliateFormat.money(AffiliateProvider.minWithdrawalAmount)}.';
    }
    if (value > balance) {
      return 'That is more than your withdrawable balance of '
          '${AffiliateFormat.money(balance)}.';
    }
    return null;
  }

  void _applyQuickAmount(double value) {
    _amountController.text = AffiliateFormat.plain(value);
    _amountController.selection = TextSelection.fromPosition(
      TextPosition(offset: _amountController.text.length),
    );
    setState(() {});
  }

  Future<void> _submit(User user, BankAccount account) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm withdrawal'),
        content: Text(
          'Request ${AffiliateFormat.money(_amount)} to '
          '${account.bankName} ${account.maskedAccountNumber}?\n\n'
          'Our team reviews and transfers it to this account.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final provider = context.read<AffiliateProvider>();
    final success = await provider.submitWithdrawal(
      uid: user.id,
      userName: user.fullName,
      userPhone: user.phone,
      amount: _amount,
      account: account,
    );
    if (!mounted) return;

    if (success) {
      AppToast.success(context, 'Withdrawal request submitted');
      if (context.canPop()) context.pop();
    } else {
      AppToast.error(
        context,
        provider.error ?? 'Could not file the withdrawal request.',
      );
    }
  }

  void _onConfirmPressed(User user) {
    final accounts = context.read<AffiliateProvider>().bankAccounts;
    BankAccount? account;
    for (final a in accounts) {
      if (a.id == _selectedAccountId) account = a;
    }

    setState(() {
      _accountError = account == null ? 'Choose a bank account.' : null;
    });

    final formOk = _formKey.currentState?.validate() ?? false;
    if (!formOk || account == null) return;

    _submit(user, account);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: affiliateAppBar(context, title: 'Complete withdrawal'),
      body: AffiliateGuard(
        requireWalletAccess: true,
        builder: (context, user) => _buildBody(context, user),
      ),
    );
  }

  Widget _buildBody(BuildContext context, User user) {
    final provider = context.watch<AffiliateProvider>();
    final accounts = provider.bankAccounts;
    final net = (_amount - AffiliateProvider.processingFee)
        .clamp(0, double.infinity)
        .toDouble();

    return Column(
      children: [
        Expanded(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                AppDimens.space12,
                AppDimens.screenPadding,
                AppDimens.space24,
              ),
              children: [
                AffiliateHeroCard(
                  label: 'Withdrawable balance',
                  amount: user.affiliateBalance,
                ),
                const SizedBox(height: AppDimens.gapSections),
                const _FieldLabel('Amount to withdraw'),
                const SizedBox(height: AppDimens.space8),
                TextFormField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: false,
                  ),
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (_) => setState(() {}),
                  validator: (_) => _validateAmount(user.affiliateBalance),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                  decoration: const InputDecoration(
                    hintText: '0',
                    prefixIcon: Padding(
                      padding: EdgeInsets.only(
                        left: AppDimens.space16,
                        right: AppDimens.space8,
                      ),
                      child: Text(
                        '₹',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    prefixIconConstraints: BoxConstraints(minWidth: 0),
                  ),
                ),
                const SizedBox(height: AppDimens.space10),
                Wrap(
                  spacing: AppDimens.space8,
                  runSpacing: AppDimens.space8,
                  children: [
                    for (final value in _quickAmounts)
                      _QuickPill(
                        label: AffiliateFormat.money(value)
                            .replaceAll('.00', ''),
                        isSelected: _amount == value,
                        onTap: () => _applyQuickAmount(value),
                      ),
                    _QuickPill(
                      label: 'All',
                      isSelected: _amount > 0 &&
                          _amount == user.affiliateBalance.floorToDouble(),
                      onTap: () =>
                          _applyQuickAmount(user.affiliateBalance.floorToDouble()),
                    ),
                  ],
                ),
                const SizedBox(height: AppDimens.gapSections),
                const _FieldLabel('To bank account'),
                const SizedBox(height: AppDimens.space10),
                if (provider.isLoadingBankAccounts && accounts.isEmpty)
                  const ShimmerLoading(
                    child: ShimmerBox(
                      width: double.infinity,
                      height: 76,
                      borderRadius: AppDimens.radiusCard,
                    ),
                  )
                else if (accounts.isEmpty)
                  const _NoBankAccountsNote()
                else
                  for (var i = 0; i < accounts.length; i++) ...[
                    BankAccountCard(
                      account: accounts[i],
                      selectable: true,
                      showIfsc: false,
                      isSelected: _selectedAccountId == accounts[i].id,
                      onSelect: () => setState(() {
                        _selectedAccountId = accounts[i].id;
                        _accountError = null;
                      }),
                    ),
                    if (i != accounts.length - 1)
                      const SizedBox(height: AppDimens.space10),
                  ],
                if (_accountError != null) ...[
                  const SizedBox(height: AppDimens.space8),
                  Text(
                    _accountError!,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.statusError,
                    ),
                  ),
                ],
                if (provider.hasBankAccountSlot) ...[
                  const SizedBox(height: AppDimens.space12),
                  CustomButton(
                    label: 'Add bank account',
                    variant: ButtonVariant.outline,
                    icon: Icons.add_rounded,
                    onPressed: () async {
                      await context.push('/affiliate/bank-accounts/add');
                      await _loadAccounts();
                    },
                  ),
                ],
                const SizedBox(height: AppDimens.gapSections),
                SectionCard(
                  child: Column(
                    children: [
                      KeyValueRow(
                        label: 'Withdrawal amount',
                        value: AffiliateFormat.money(_amount),
                      ),
                      KeyValueRow(
                        label: 'Processing fee',
                        value: AffiliateFormat.money(
                          AffiliateProvider.processingFee,
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(
                          vertical: AppDimens.space8,
                        ),
                        child: Divider(height: 1, color: AppColors.hairline),
                      ),
                      KeyValueRow(
                        label: 'Net amount',
                        value: AffiliateFormat.money(net),
                        emphasis: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        SafeArea(
          top: false,
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
              label: 'Confirm withdrawal',
              isLoading: provider.isSubmitting,
              onPressed: () => _onConfirmPressed(user),
            ),
          ),
        ),
      ],
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      ),
    );
  }
}

/// Message-only note when no payout account is saved yet. The "Add bank
/// account" button below it is the screen's own action, not part of an empty
/// state's body (spec §2.25).
class _NoBankAccountsNote extends StatelessWidget {
  const _NoBankAccountsNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.cardPadding,
        vertical: AppDimens.space20,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      ),
      child: const Text(
        'No bank account saved yet. Add one to receive your withdrawal.',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 13,
          height: 1.5,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

/// One quick-amount pill (design frame 39: brand-green fill when selected).
class _QuickPill extends StatelessWidget {
  const _QuickPill({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.brandGreen
              : AppColors.brandGreenSubtle,
          borderRadius: BorderRadius.circular(AppDimens.radiusPill),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isSelected ? Colors.white : AppColors.brandGreen,
          ),
        ),
      ),
    );
  }
}
