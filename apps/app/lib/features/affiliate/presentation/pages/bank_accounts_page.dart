import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../domain/entities/bank_account.dart';
import '../providers/affiliate_provider.dart';
import '../widgets/affiliate_scaffold.dart';
import '../widgets/bank_account_card.dart';

/// Saved payout accounts (spec §2.22 — max 2 per affiliate).
///
/// There is NO design frame for this list (design map §2: "Bank accounts
/// (list) — no frame"), so it is built from the spec in the established visual
/// language: the same bordered cards the withdraw screen uses, with the delete
/// action and the cap note.
class BankAccountsPage extends StatefulWidget {
  const BankAccountsPage({super.key});

  @override
  State<BankAccountsPage> createState() => _BankAccountsPageState();
}

class _BankAccountsPageState extends State<BankAccountsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final uid = context.read<AuthProvider>().currentUser?.id;
    if (uid == null || !mounted) return;
    await context.read<AffiliateProvider>().loadBankAccounts(uid);
  }

  Future<void> _confirmDelete(BankAccount account) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete bank account'),
        content: Text(
          'Remove ${account.bankName} ${account.maskedAccountNumber}? '
          'Withdrawals already filed to it are not affected.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final uid = context.read<AuthProvider>().currentUser?.id;
    if (uid == null) return;
    final provider = context.read<AffiliateProvider>();
    final success = await provider.deleteBankAccount(
      uid: uid,
      accountId: account.id,
    );
    if (!mounted) return;
    AppToast.result(
      context,
      error: success ? null : (provider.error ?? 'Could not delete the bank account.'),
      successMessage: 'Bank account deleted',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: affiliateAppBar(context, title: 'Bank accounts'),
      body: AffiliateGuard(
        requireWalletAccess: true,
        builder: (context, _) => RefreshIndicator(
          color: AppColors.brandGreen,
          onRefresh: _load,
          child: _buildList(context),
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context) {
    final provider = context.watch<AffiliateProvider>();
    final accounts = provider.bankAccounts;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        if (provider.isLoadingBankAccounts && accounts.isEmpty)
          ShimmerLoading(
            child: Column(
              children: List.generate(
                AffiliateProvider.maxBankAccounts,
                (_) => const Padding(
                  padding: EdgeInsets.only(bottom: AppDimens.gapCards),
                  child: ShimmerBox(
                    width: double.infinity,
                    height: 88,
                    borderRadius: AppDimens.radiusCard,
                  ),
                ),
              ),
            ),
          )
        else if (provider.bankAccountsError != null && accounts.isEmpty) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppDimens.cardPadding),
            decoration: BoxDecoration(
              color: AppColors.statusErrorSubtle,
              borderRadius: BorderRadius.circular(AppDimens.radiusCard),
            ),
            child: Text(
              provider.bankAccountsError!,
              style: const TextStyle(
                fontSize: 13,
                height: 1.45,
                color: AppColors.statusError,
              ),
            ),
          ),
          const SizedBox(height: AppDimens.gapCards),
          CustomButton(
            label: 'Retry',
            variant: ButtonVariant.outline,
            onPressed: _load,
          ),
        ] else if (accounts.isEmpty)
          // Spec §2.25 — empty states are message only.
          const _EmptyAccountsNote()
        else
          for (var i = 0; i < accounts.length; i++) ...[
            BankAccountCard(
              account: accounts[i],
              onDelete: provider.isSubmitting
                  ? null
                  : () => _confirmDelete(accounts[i]),
            ),
            if (i != accounts.length - 1)
              const SizedBox(height: AppDimens.gapCards),
          ],
        const SizedBox(height: AppDimens.gapSections),
        if (provider.hasBankAccountSlot)
          CustomButton(
            label: 'Add bank account',
            icon: Icons.add_rounded,
            onPressed: () async {
              await context.push('/affiliate/bank-accounts/add');
              await _load();
            },
          )
        else
          const _AccountLimitNote(),
      ],
    );
  }
}

class _EmptyAccountsNote extends StatelessWidget {
  const _EmptyAccountsNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.cardPadding,
        vertical: AppDimens.space24,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      ),
      child: const Text(
        'No bank account saved yet. Your withdrawals are transferred to the '
        'account you save here.',
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

/// Replaces the add button once both slots are used (spec §2.22).
class _AccountLimitNote extends StatelessWidget {
  const _AccountLimitNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: AppColors.textSecondary,
          ),
          SizedBox(width: AppDimens.space10),
          Expanded(
            child: Text(
              'You can save up to ${AffiliateProvider.maxBankAccounts} bank '
              'accounts. Delete one to add another.',
              style: TextStyle(
                fontSize: 12,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
