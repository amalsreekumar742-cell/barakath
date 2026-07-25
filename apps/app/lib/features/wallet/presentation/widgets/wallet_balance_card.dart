import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import 'wallet_money.dart';

/// The green gradient balance card at the top of the wallet tab.
///
/// Frame `26 · Normal Wallet`: 16px radius, 22px padding, a brand-green →
/// brand-green-dark gradient with a soft circle bleeding off the top-right, and
/// three stacked lines. The all-caps label is verbatim from spec §2.20.
class WalletBalanceCard extends StatelessWidget {
  const WalletBalanceCard({super.key, required this.balance});

  final double balance;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppDimens.radiusXl),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brandGreen, AppColors.brandGreenDark],
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: -82,
            right: -62,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'NORMAL WALLET BALANCE',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.48,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(height: AppDimens.space8),
              Text(
                WalletMoney.format(balance),
                style: const TextStyle(
                  fontSize: 38,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.76,
                  color: Colors.white,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: AppDimens.space4),
              Text(
                // Spec §2.20: "Balance never expires".
                'Never expires — use it at checkout on any order',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
