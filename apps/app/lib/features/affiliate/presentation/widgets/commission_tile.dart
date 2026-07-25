import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../domain/entities/affiliate_transaction.dart';
import 'affiliate_format.dart';

/// One row of the commission ledger (`affiliateTransactions`).
///
/// Shows who the referral came from, the order it belongs to, the fixed ₹
/// amount, its status, and — while Pending — the date it clears. Commission is
/// a FIXED amount per variant, so there is no percentage anywhere on this tile.
class CommissionTile extends StatelessWidget {
  const CommissionTile({super.key, required this.transaction});

  final AffiliateTransaction transaction;

  @override
  Widget build(BuildContext context) {
    final status = CommissionStatusX.from(transaction.status);
    final isPending = status == CommissionStatus.pending;
    final isCredit = transaction.isCredit;

    final title = transaction.referredUserName.trim().isNotEmpty
        ? 'Referral from ${transaction.referredUserName.trim()}'
        : (transaction.description.trim().isNotEmpty
            ? transaction.description.trim()
            : 'Referral commission');

    return Container(
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
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
              color: AppColors.brandGreenSubtle,
              borderRadius: BorderRadius.circular(AppDimens.radiusMd),
            ),
            child: const Icon(
              Icons.favorite_border_rounded,
              size: 19,
              color: AppColors.brandGreen,
            ),
          ),
          const SizedBox(width: AppDimens.space12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: AppDimens.space4),
                Text(
                  transaction.orderId.trim().isEmpty
                      ? AffiliateFormat.date(transaction.createdAt)
                      : 'Order #${transaction.orderId} · '
                          '${AffiliateFormat.date(transaction.createdAt)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: AppDimens.space8),
                Row(
                  children: [
                    StatusBadge.forStatus(status.label, dense: true),
                    if (isPending && transaction.clearsAt != null) ...[
                      const SizedBox(width: AppDimens.space8),
                      Flexible(
                        child: Text(
                          'Clears ${AffiliateFormat.date(transaction.clearsAt)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textFaint,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: AppDimens.space8),
          Text(
            '${isCredit ? '+' : '−'}${AffiliateFormat.money(transaction.amount)}',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: isCredit
                  ? AppColors.semanticSuccess
                  : AppColors.statusError,
            ),
          ),
        ],
      ),
    );
  }
}
