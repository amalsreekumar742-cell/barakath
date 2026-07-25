import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/affiliate_provider.dart';
import '../widgets/affiliate_scaffold.dart';

/// Add bank account (spec §2.22, design frame "30 · Add bank account").
///
/// Holder name, account number entered twice, and an IFSC that is verified
/// against the bank directory on blur — the resolved bank and branch are what
/// get stored, so the customer never types a bank name.
class AddBankAccountPage extends StatefulWidget {
  const AddBankAccountPage({super.key});

  @override
  State<AddBankAccountPage> createState() => _AddBankAccountPageState();
}

class _AddBankAccountPageState extends State<AddBankAccountPage> {
  final _formKey = GlobalKey<FormState>();
  final _holderController = TextEditingController();
  final _accountController = TextEditingController();
  final _confirmAccountController = TextEditingController();
  final _ifscController = TextEditingController();
  final _ifscFocus = FocusNode();

  /// Only set after a successful lookup; submission is blocked without it.
  String _verifiedIfsc = '';

  @override
  void initState() {
    super.initState();
    _ifscFocus.addListener(_onIfscFocusChange);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final uid = context.read<AuthProvider>().currentUser?.id;
      if (uid == null || !mounted) return;
      // The cap and the duplicate check both need the current list.
      context.read<AffiliateProvider>().loadBankAccounts(uid);
      context.read<AffiliateProvider>().clearIfsc();
    });
  }

  @override
  void dispose() {
    _ifscFocus.removeListener(_onIfscFocusChange);
    _ifscFocus.dispose();
    _holderController.dispose();
    _accountController.dispose();
    _confirmAccountController.dispose();
    _ifscController.dispose();
    super.dispose();
  }

  /// Auto-verify on blur (spec §2.22 "IFSC (auto-verify)") — not on every
  /// keystroke, which would fire ten failing lookups per code typed.
  Future<void> _onIfscFocusChange() async {
    if (_ifscFocus.hasFocus) return;
    await _verifyIfsc();
  }

  Future<void> _verifyIfsc() async {
    final code = _ifscController.text.trim().toUpperCase();
    if (code.length != 11 || code == _verifiedIfsc) return;
    final details = await context.read<AffiliateProvider>().verifyIfsc(code);
    if (!mounted) return;
    setState(() => _verifiedIfsc = details == null ? '' : details.ifsc);
  }

  String? _validateHolder(String? value) =>
      (value ?? '').trim().isEmpty ? 'Enter the account holder name.' : null;

  String? _validateAccount(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return 'Enter the account number.';
    if (v.length < 6) return 'That account number looks too short.';
    if (context.read<AffiliateProvider>().isAccountNumberSaved(v)) {
      return 'This bank account is already saved.';
    }
    return null;
  }

  String? _validateConfirmAccount(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return 'Re-enter the account number.';
    if (v != _accountController.text.trim()) {
      return 'The account numbers do not match.';
    }
    return null;
  }

  String? _validateIfsc(String? value) {
    final v = (value ?? '').trim().toUpperCase();
    if (v.isEmpty) return 'Enter the IFSC code.';
    if (v.length != 11) return 'An IFSC code is 11 characters.';
    if (_verifiedIfsc != v) {
      return 'Verify the IFSC code before saving.';
    }
    return null;
  }

  Future<void> _save(User user) async {
    final provider = context.read<AffiliateProvider>();

    if (!provider.hasBankAccountSlot) {
      AppToast.error(
        context,
        'You can save up to ${AffiliateProvider.maxBankAccounts} bank accounts. '
        'Delete one to add another.',
      );
      return;
    }

    // Blur first so a code typed and submitted without leaving the field is
    // still verified before validation runs.
    _ifscFocus.unfocus();
    await _verifyIfsc();
    if (!mounted) return;

    if (!(_formKey.currentState?.validate() ?? false)) return;

    final details = provider.ifscDetails;
    if (details == null) {
      AppToast.error(context, 'Verify the IFSC code before saving.');
      return;
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save bank account'),
        content: Text(
          'Save ${details.bank} · ${_holderController.text.trim()}?\n\n'
          'Withdrawals you request will be transferred to this account.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final success = await provider.addBankAccount(
      uid: user.id,
      accountHolderName: _holderController.text,
      accountNumber: _accountController.text,
      ifscCode: details.ifsc,
      bankName: details.bank,
      bankBranch: details.branch,
    );
    if (!mounted) return;

    if (success) {
      AppToast.success(context, 'Bank account saved');
      if (context.canPop()) context.pop();
    } else {
      AppToast.error(context, provider.error ?? 'Could not save the bank account.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: affiliateAppBar(context, title: 'Add bank account'),
      body: AffiliateGuard(
        requireWalletAccess: true,
        builder: (context, user) => _buildForm(context, user),
      ),
    );
  }

  Widget _buildForm(BuildContext context, User user) {
    final provider = context.watch<AffiliateProvider>();

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
                const _IntroBanner(),
                const SizedBox(height: AppDimens.space16),
                CustomTextField(
                  label: 'Account holder name',
                  hint: 'As printed on your passbook',
                  controller: _holderController,
                  textInputAction: TextInputAction.next,
                  validator: _validateHolder,
                ),
                const SizedBox(height: AppDimens.space16),
                CustomTextField(
                  label: 'Account number',
                  hint: 'Enter account number',
                  controller: _accountController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textInputAction: TextInputAction.next,
                  validator: _validateAccount,
                ),
                const SizedBox(height: AppDimens.space16),
                CustomTextField(
                  label: 'Re-enter account number',
                  hint: 'Re-enter account number',
                  controller: _confirmAccountController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textInputAction: TextInputAction.next,
                  validator: _validateConfirmAccount,
                ),
                const SizedBox(height: AppDimens.space16),
                CustomTextField(
                  label: 'IFSC code',
                  hint: 'e.g. HDFC0001234',
                  controller: _ifscController,
                  focusNode: _ifscFocus,
                  maxLength: 11,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp('[a-zA-Z0-9]')),
                    _UpperCaseFormatter(),
                  ],
                  validator: _validateIfsc,
                  onChanged: (_) {
                    if (_verifiedIfsc.isEmpty &&
                        provider.ifscDetails == null &&
                        provider.ifscError == null) {
                      return;
                    }
                    setState(() => _verifiedIfsc = '');
                    context.read<AffiliateProvider>().clearIfsc();
                  },
                  suffix: provider.isVerifyingIfsc
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                ),
                if (provider.ifscDetails != null) ...[
                  const SizedBox(height: AppDimens.space10),
                  _VerifiedBankNote(
                    bank: provider.ifscDetails!.bank,
                    branch: provider.ifscDetails!.branch,
                  ),
                ],
                if (provider.ifscError != null) ...[
                  const SizedBox(height: AppDimens.space10),
                  Text(
                    provider.ifscError!,
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.45,
                      color: AppColors.statusError,
                    ),
                  ),
                ],
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
              label: 'Save account',
              isLoading: provider.isSubmitting,
              onPressed: () => _save(user),
            ),
          ),
        ),
      ],
    );
  }
}

/// Forces the IFSC field to upper case as it's typed — the directory and the
/// stored value are both upper case, so a lower-case entry would look "wrong"
/// on the account card even though it resolves.
class _UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return newValue.copyWith(text: newValue.text.toUpperCase());
  }
}

class _IntroBanner extends StatelessWidget {
  const _IntroBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.space16,
        vertical: AppDimens.space14,
      ),
      decoration: BoxDecoration(
        color: AppColors.brandGreenSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      ),
      child: const Row(
        children: [
          Icon(
            Icons.account_balance_wallet_outlined,
            size: 20,
            color: AppColors.brandGreen,
          ),
          SizedBox(width: AppDimens.space12),
          Expanded(
            child: Text(
              'Withdraw your affiliate earnings straight to this account.',
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The inline "verified from IFSC" block from design frame 30.
class _VerifiedBankNote extends StatelessWidget {
  const _VerifiedBankNote({required this.bank, required this.branch});

  final String bank;
  final String branch;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.space16,
        vertical: 13,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusMd),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_rounded,
            size: 18,
            color: AppColors.brandGreen,
          ),
          const SizedBox(width: AppDimens.space10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  bank,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  branch.trim().isEmpty
                      ? 'Verified from IFSC'
                      : '$branch · verified from IFSC',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
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
}
