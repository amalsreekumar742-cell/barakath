import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import 'wallet_money.dart';

/// The breakdown row under the balance card.
///
/// ONE tile — Rewards. The Refunds tile was removed: a refund already reads
/// clearly in the ledger below it, so a lifetime total added nothing, and it sat
/// at ₹0 for every customer who had never cancelled an order. The prototype's
/// third Cashback tile is a design/spec conflict the spec wins
/// (docs/design/app/BATCH4_DESIGN_MAP.md §4 row 1) — cashback exists nowhere in
/// the product.
///
/// The figure comes from Firestore aggregation `sum()` queries, not from
/// totalling the loaded page, and it covers BOTH store rewards and admin
/// credits.
class WalletBreakdownTiles extends StatelessWidget {
  const WalletBreakdownTiles({super.key, required this.rewardsTotal});

  final double rewardsTotal;

  @override
  Widget build(BuildContext context) {
    // A single tile spans the row, so no IntrinsicHeight is needed to equalise
    // sibling heights any more — and no `stretch`, which is what forced an
    // infinite height into this row back when there were two.
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.goldSubtle,
              borderRadius: BorderRadius.circular(AppDimens.radiusMd),
            ),
            child: const Icon(
              Icons.card_giftcard_rounded,
              size: 20,
              color: AppColors.goldStrong,
            ),
          ),
          const SizedBox(width: AppDimens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  WalletMoney.format(rewardsTotal),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Rewards received',
                  style: TextStyle(
                    fontSize: 12,
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
