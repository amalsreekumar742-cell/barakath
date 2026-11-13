import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/paginated_list_view.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../domain/entities/affiliate_transaction.dart';
import '../../domain/entities/affiliate_withdrawal.dart';
import '../providers/affiliate_provider.dart';
import '../widgets/affiliate_format.dart';
import '../widgets/affiliate_scaffold.dart';
import '../widgets/affiliate_stat_cards.dart';
import '../widgets/commission_tile.dart';
import '../widgets/withdrawal_tile.dart';

/// Affiliate wallet (spec §2.22, design frame "28 · Affiliate Wallet").
///
/// The withdrawable balance is prominent; pending commission is a secondary
/// line that says plainly it clears after 7 days and is confirmed manually by
/// admin. Below it, two tabs — the commission ledger and the payout requests
/// filed so far — each a cursor-paginated list that loads its next page as the
/// customer scrolls.
///
/// WHY tabs and not two stacked lists: a list that keeps growing as you scroll
/// can only sit at the BOTTOM of a screen. Stacked, the commission ledger would
/// push the withdrawals further down with every page and they'd never be
/// reachable.
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

enum _WalletTab { commissions, withdrawals }

class _WalletBody extends StatefulWidget {
  const _WalletBody({required this.user});

  final User user;

  @override
  State<_WalletBody> createState() => _WalletBodyState();
}

class _WalletBodyState extends State<_WalletBody> {
  _WalletTab _tab = _WalletTab.commissions;

  User get _user => widget.user;

  bool get _canWithdraw =>
      _user.affiliateBalance >= AffiliateProvider.minWithdrawalAmount;

  /// Same row shape the sections used before the move to tabs.
  static const _rowSkeleton = ShimmerLoading(
    child: ShimmerBox(
      width: double.infinity,
      height: 84,
      borderRadius: AppDimens.radiusCard,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AffiliateProvider>();
    final uid = _user.id;
    final header = _header();

    switch (_tab) {
      case _WalletTab.commissions:
        return PaginatedListView<AffiliateTransaction>(
          key: const ValueKey(_WalletTab.commissions),
          header: header,
          items: provider.commissions,
          itemBuilder: (_, transaction, __) =>
              CommissionTile(transaction: transaction),
          isLoading: provider.isLoadingCommissions,
          isLoadingMore: provider.isLoadingMoreCommissions,
          hasMore: provider.hasMoreCommissions,
          onLoadMore: () =>
              context.read<AffiliateProvider>().loadMoreCommissions(uid),
          error: provider.commissionsError,
          onRetry: () =>
              context.read<AffiliateProvider>().loadCommissions(uid),
          emptyIcon: Icons.payments_outlined,
          emptyTitle: 'No commission yet',
          emptySubtitle: 'Share your referral code to start earning.',
          skeleton: _rowSkeleton,
          skeletonCount: 3,
        );
      case _WalletTab.withdrawals:
        return PaginatedListView<AffiliateWithdrawal>(
          key: const ValueKey(_WalletTab.withdrawals),
          header: header,
          items: provider.withdrawals,
          itemBuilder: (_, withdrawal, __) =>
              WithdrawalTile(withdrawal: withdrawal),
          isLoading: provider.isLoadingWithdrawals,
          isLoadingMore: provider.isLoadingMoreWithdrawals,
          hasMore: provider.hasMoreWithdrawals,
          onLoadMore: () =>
              context.read<AffiliateProvider>().loadMoreWithdrawals(uid),
          error: provider.withdrawalsError,
          onRetry: () =>
              context.read<AffiliateProvider>().loadWithdrawals(uid),
          emptyIcon: Icons.account_balance_outlined,
          emptyTitle: 'No withdrawal requests',
          emptySubtitle: "You haven't requested a withdrawal yet.",
          skeleton: _rowSkeleton,
          skeletonCount: 2,
        );
    }
  }

  /// Balance, the withdraw action and the tab switch — scrolls with the list.
  Widget _header() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AffiliateHeroCard(
          label: 'Withdrawable balance',
          amount: _user.affiliateBalance,
          footnote:
              '${AffiliateFormat.money(_user.pendingCommission)} pending — '
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
        Row(
          children: [
            _TabChip(
              label: 'Commission history',
              selected: _tab == _WalletTab.commissions,
              onTap: () => setState(() => _tab = _WalletTab.commissions),
            ),
            const SizedBox(width: AppDimens.space8),
            _TabChip(
              label: 'Withdrawals',
              selected: _tab == _WalletTab.withdrawals,
              onTap: () => setState(() => _tab = _WalletTab.withdrawals),
            ),
          ],
        ),
        if (_tab == _WalletTab.commissions) ...[
          const SizedBox(height: AppDimens.space8),
          const Text(
            'You earn a fixed amount every time someone shops with your code.',
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
        ],
        // The list adds no gap under its header, so the header carries it.
        const SizedBox(height: AppDimens.space12),
      ],
    );
  }
}

/// Pill tab, styled like the My coupons tabs.
class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radiusPill),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandGreen : AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusPill),
          border: Border.all(
            color: selected ? AppColors.brandGreen : AppColors.hairline,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}
