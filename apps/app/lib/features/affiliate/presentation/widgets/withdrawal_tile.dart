import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/status_badge.dart';
import '../../domain/entities/affiliate_withdrawal.dart';
import 'affiliate_format.dart';

/// One filed payout request (`affiliateWithdrawals`).
///
/// The account number is ALWAYS masked (`entity.maskedAccountNumber`) — a full
/// number never renders anywhere in the app. When admin rejects a request, the
/// reason is shown so the affiliate knows what to fix; there is no payout SLA
/// copy, because admin transfers outside the system and the store has promised
/// no window (design map §4 row 9).
class WithdrawalTile extends StatelessWidget {
  const WithdrawalTile({super.key, required this.withdrawal});

  final AffiliateWithdrawal withdrawal;

  @override
  Widget build(BuildContext context) {
    final status = WithdrawalStatusX.from(withdrawal.status);
    final isRejected = status == WithdrawalStatus.rejected;

    return Container(
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSubtle,
                  borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                ),
                child: const Icon(
                  Icons.account_balance_outlined,
                  size: 19,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(width: AppDimens.space12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      withdrawal.bankName.trim().isEmpty
                          ? 'Withdrawal ${withdrawal.maskedAccountNumber}'
                          : '${withdrawal.bankName} '
                              '${withdrawal.maskedAccountNumber}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppDimens.space4),
                    Text(
                      'Requested ${AffiliateFormat.date(withdrawal.createdAt)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppDimens.space8),
                    StatusBadge.forStatus(status.label, dense: true),
                  ],
                ),
              ),
              const SizedBox(width: AppDimens.space8),
              Text(
                AffiliateFormat.money(withdrawal.amount),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          if (isRejected && withdrawal.rejectionReason.trim().isNotEmpty) ...[
            const SizedBox(height: AppDimens.space10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppDimens.space10),
              decoration: BoxDecoration(
                color: AppColors.statusErrorSubtle,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
              ),
              child: Text(
                withdrawal.rejectionReason.trim(),
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.45,
                  color: AppColors.statusError,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
