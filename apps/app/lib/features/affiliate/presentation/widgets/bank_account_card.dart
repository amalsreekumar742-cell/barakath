import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../domain/entities/bank_account.dart';

/// A saved payout account, in two shapes:
///
/// * manage (`onDelete` set) — bank, holder, masked number, IFSC, delete icon;
/// * choose ([selectable]) — the radio card on the withdraw screen.
///
/// The account number is only ever rendered through
/// [BankAccount.maskedAccountNumber].
class BankAccountCard extends StatelessWidget {
  const BankAccountCard({
    super.key,
    required this.account,
    this.selectable = false,
    this.isSelected = false,
    this.onSelect,
    this.onDelete,
    this.showIfsc = true,
  });

  final BankAccount account;
  final bool selectable;
  final bool isSelected;
  final VoidCallback? onSelect;
  final VoidCallback? onDelete;
  final bool showIfsc;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: selectable ? onSelect : null,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(AppDimens.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          border: Border.all(
            color: selectable && isSelected
                ? AppColors.brandGreen
                : AppColors.hairline,
            width: selectable && isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            if (selectable) ...[
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color:
                      isSelected ? AppColors.brandGreen : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected
                        ? AppColors.brandGreen
                        : AppColors.borderStrong,
                    width: 1.5,
                  ),
                ),
                child: isSelected
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
                      )
                    : null,
              ),
              const SizedBox(width: AppDimens.space12),
            ] else ...[
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
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${account.bankName} ${account.maskedAccountNumber}'.trim(),
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
                    account.accountHolderName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  if (showIfsc && account.ifscCode.isNotEmpty) ...[
                    const SizedBox(height: AppDimens.space4),
                    Text(
                      account.bankBranch.trim().isEmpty
                          ? 'IFSC ${account.ifscCode}'
                          : 'IFSC ${account.ifscCode} · ${account.bankBranch}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.textFaint,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (onDelete != null)
              IconButton(
                onPressed: onDelete,
                tooltip: 'Delete account',
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  size: 20,
                  color: AppColors.statusError,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
