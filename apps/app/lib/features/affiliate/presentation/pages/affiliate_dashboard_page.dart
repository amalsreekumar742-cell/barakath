import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../auth/domain/entities/user.dart';
import '../widgets/affiliate_format.dart';
import '../widgets/affiliate_scaffold.dart';
import '../widgets/affiliate_stat_cards.dart';
import '../widgets/referral_code_card.dart';

/// Affiliate dashboard (spec §2.22, design frame "27 · Affiliate dashboard").
///
/// Four stats — total earnings, pending, confirmed, referrals — read straight
/// off the live `users/{uid}` document `AuthProvider` already mirrors. The
/// prototype's "+₹180.00 this month" is deliberately absent: no month-to-date
/// field exists (design map §4 row 8).
class AffiliateDashboardPage extends StatelessWidget {
  const AffiliateDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: affiliateAppBar(
        context,
        title: 'Affiliate',
        trailing: const AffiliateBadge(),
      ),
      body: AffiliateGuard(
        builder: (context, user) => _DashboardBody(user: user),
      ),
    );
  }
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.user});

  final User user;

  /// Total earnings = pending + confirmed. There is no `totalEarnings` field on
  /// the user document; those two are the whole ledger, so their sum is exact.
  double get _totalEarnings =>
      user.pendingCommission + user.confirmedCommission;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        AffiliateHeroCard(label: 'Total earnings', amount: _totalEarnings),
        const SizedBox(height: AppDimens.gapCards),
        Row(
          children: [
            Expanded(
              child: AffiliateStatTile(
                label: 'Pending',
                value: AffiliateFormat.money(user.pendingCommission),
              ),
            ),
            const SizedBox(width: AppDimens.space10),
            Expanded(
              child: AffiliateStatTile(
                label: 'Confirmed',
                value: AffiliateFormat.money(user.confirmedCommission),
              ),
            ),
            const SizedBox(width: AppDimens.space10),
            Expanded(
              child: AffiliateStatTile(
                label: 'Referrals',
                value: '${user.totalReferrals}',
              ),
            ),
          ],
        ),
        const SizedBox(height: AppDimens.gapCards),
        ReferralCodeCard(code: user.affiliateCode),
        const SizedBox(height: AppDimens.gapSections),
        if (user.affiliateEnabled) ...[
          CustomButton(
            label: 'Affiliate wallet',
            onPressed: () => context.push('/affiliate/wallet'),
          ),
          const SizedBox(height: AppDimens.gapCards),
          CustomButton(
            label: 'Bank accounts',
            variant: ButtonVariant.outline,
            onPressed: () => context.push('/affiliate/bank-accounts'),
          ),
        ] else
          const _WalletDisabledCard(),
      ],
    );
  }
}

/// Replaces the wallet entry point when admin has switched `affiliateEnabled`
/// off. The customer keeps earning — they simply cannot open the wallet or file
/// a withdrawal until admin turns access back on.
class _WalletDisabledCard extends StatelessWidget {
  const _WalletDisabledCard();

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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.subtle,
              borderRadius: BorderRadius.circular(AppDimens.radiusMd),
            ),
            child: const Icon(
              Icons.lock_outline_rounded,
              size: 19,
              color: AppColors.muted,
            ),
          ),
          const SizedBox(width: AppDimens.space12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Wallet access is off',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                SizedBox(height: AppDimens.space4),
                Text(
                  'Your commission keeps building up. The affiliate wallet and '
                  'withdrawals are switched off for your account right now — '
                  'please contact support to have them enabled.',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.45,
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
