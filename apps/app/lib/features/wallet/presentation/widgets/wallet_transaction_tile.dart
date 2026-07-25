import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../domain/entities/wallet_transaction.dart';
import 'wallet_money.dart';

/// One row of the wallet ledger (frame `26 · Normal Wallet`): a 40px tinted
/// source icon, the description + date, and the signed amount on the right.
///
/// Credits are green with a leading "+", debits red with "−" (the design paints
/// debits in ink; the Batch-4 design map pins them to `AppColors.statusError`).
class WalletTransactionTile extends StatelessWidget {
  const WalletTransactionTile({super.key, required this.transaction});

  final WalletTransaction transaction;

  /// Icon + tint per source. An unknown source (a newer admin build writing a
  /// value this app doesn't know) still renders, with the neutral wallet glyph.
  ({IconData icon, Color fg, Color bg}) get _visuals {
    switch (transaction.walletSource) {
      case WalletSource.upiTopUp:
        return (
          icon: Icons.add_rounded,
          fg: AppColors.brandGreen,
          bg: AppColors.brandGreenSubtle,
        );
      case WalletSource.reward:
        return (
          icon: Icons.card_giftcard_rounded,
          fg: AppColors.goldStrong,
          bg: AppColors.goldSubtle,
        );
      case WalletSource.purchase:
        return (
          icon: Icons.shopping_bag_outlined,
          fg: AppColors.brandGreen,
          bg: AppColors.brandGreenSubtle,
        );
      case WalletSource.refund:
        return (
          icon: Icons.south_rounded,
          fg: AppColors.semanticSuccess,
          bg: AppColors.semanticSuccessSubtle,
        );
      case WalletSource.adminCredit:
        return (
          icon: Icons.verified_user_outlined,
          fg: AppColors.brandGreen,
          bg: AppColors.brandGreenSubtle,
        );
      case null:
        return (
          icon: Icons.account_balance_wallet_outlined,
          fg: AppColors.textSecondary,
          bg: AppColors.surfaceSubtle,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final visuals = _visuals;
    final isCredit = transaction.isCredit;
    final date = WalletMoney.date(transaction.createdAt);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: visuals.bg,
            borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          ),
          child: Icon(visuals.icon, size: 19, color: visuals.fg),
        ),
        const SizedBox(width: AppDimens.space12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                transaction.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              if (date.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(
                  date,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textFaint,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: AppDimens.space8),
        Text(
          WalletMoney.signed(transaction.amount, isCredit: isCredit),
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color:
                isCredit ? AppColors.semanticSuccess : AppColors.statusError,
          ),
        ),
      ],
    );
  }
}

/// Skeleton shaped like [WalletTransactionTile], used while page 1 loads
/// (skill: content loads show a shaped shimmer, never a bare spinner).
class WalletTransactionSkeleton extends StatelessWidget {
  const WalletTransactionSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Row(
        children: [
          _SkeletonBox(width: 40, height: 40, radius: AppDimens.radiusMd),
          SizedBox(width: AppDimens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SkeletonBox(height: 12),
                SizedBox(height: AppDimens.space8),
                _SkeletonBox(width: 84, height: 10),
              ],
            ),
          ),
          SizedBox(width: AppDimens.space8),
          _SkeletonBox(width: 64, height: 14),
        ],
      ),
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    this.width,
    required this.height,
    this.radius = AppDimens.radiusXs,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.subtle,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
