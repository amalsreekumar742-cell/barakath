import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/affiliate_provider.dart';
import '../widgets/affiliate_format.dart';
import '../widgets/affiliate_scaffold.dart';
import '../widgets/affiliate_section.dart';
import '../widgets/affiliate_stat_cards.dart';
import '../widgets/commission_tile.dart';
import '../widgets/withdrawal_tile.dart';

/// Affiliate wallet (spec §2.22, design frame "28 · Affiliate Wallet").
///
/// The withdrawable balance is prominent; pending commission is a secondary
/// line that says plainly it clears after 7 days and is confirmed manually by
/// admin. Two cursor-paginated sections follow — the commission ledger and the
/// payout requests filed so far.
class AffiliateWalletPage extends StatefulWidget {
  const AffiliateWalletPage({super.key});

  @override
  State<AffiliateWalletPage> createState() => _AffiliateWalletPageState();
}

class _AffiliateWalletPageState extends State<AffiliateWalletPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  String? get _uid => context.read<AuthProvider>().currentUser?.id;

  Future<void> _load() async {
    final uid = _uid;
    if (uid == null || !mounted) return;
    final provider = context.read<AffiliateProvider>();
    await Future.wait([
      provider.loadCommissions(uid),
      provider.loadWithdrawals(uid),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: affiliateAppBar(context, title: 'Affiliate Wallet'),
      body: AffiliateGuard(
        requireWalletAccess: true,
        builder: (context, user) => RefreshIndicator(
          color: AppColors.brandGreen,
          onRefresh: _load,
          child: _WalletBody(user: user),
        ),
      ),
    );
  }
}

class _WalletBody extends StatelessWidget {
  const _WalletBody({required this.user});

  final User user;

  bool get _canWithdraw =>
      user.affiliateBalance >= AffiliateProvider.minWithdrawalAmount;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AffiliateProvider>();
    final uid = user.id;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
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
          footnote:
              '${AffiliateFormat.money(user.pendingCommission)} pending — '
              'commission clears ${AppDetails.affiliateClearingDays} days after '
              'the sale, then admin confirms it.',
        ),
        const SizedBox(height: AppDimens.gapCards),
        CustomButton(
          label: 'Withdraw to bank',
          isDisabled: !_canWithdraw,
          onPressed: _canWithdraw
              ? () => context.push('/affiliate/withdraw')
              : null,
        ),
        if (!_canWithdraw) ...[
          const SizedBox(height: AppDimens.space8),
          Text(
            'You can withdraw once your confirmed balance reaches '
            '${AffiliateFormat.money(AffiliateProvider.minWithdrawalAmount)}.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: AppDimens.gapSections),
        AffiliateSection(
          title: 'Commission history',
          caption:
              'You earn a fixed amount every time someone shops with your code.',
          itemCount: provider.commissions.length,
          itemBuilder: (_, i) =>
              CommissionTile(transaction: provider.commissions[i]),
          isLoading: provider.isLoadingCommissions,
          isLoadingMore: provider.isLoadingMoreCommissions,
          hasMore: provider.hasMoreCommissions,
          onLoadMore: () =>
              context.read<AffiliateProvider>().loadMoreCommissions(uid),
          error: provider.commissionsError,
          onRetry: () =>
              context.read<AffiliateProvider>().loadCommissions(uid),
          emptyMessage:
              'No commission yet. Share your referral code to start earning.',
        ),
        const SizedBox(height: AppDimens.gapSections),
        AffiliateSection(
          title: 'Withdrawal requests',
          itemCount: provider.withdrawals.length,
          itemBuilder: (_, i) =>
              WithdrawalTile(withdrawal: provider.withdrawals[i]),
          isLoading: provider.isLoadingWithdrawals,
          isLoadingMore: provider.isLoadingMoreWithdrawals,
          hasMore: provider.hasMoreWithdrawals,
          onLoadMore: () =>
              context.read<AffiliateProvider>().loadMoreWithdrawals(uid),
          error: provider.withdrawalsError,
          onRetry: () =>
              context.read<AffiliateProvider>().loadWithdrawals(uid),
          emptyMessage: "You haven't requested a withdrawal yet.",
          skeletonCount: 2,
        ),
      ],
    );
  }
}
