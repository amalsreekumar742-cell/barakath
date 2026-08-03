import 'dart:math' as math;

import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../domain/entities/coupon_wallet_status.dart';
import '../../domain/entities/spin_result.dart';
import 'coupon_code_box.dart';

/// The outcome sheet, shown only AFTER the wheel has finished landing on the
/// wedge the server picked.
///
/// A win gets a confetti burst, the reward headline, the minted code with Copy,
/// its conditions and expiry, and "Save to coupons" — which is pure navigation:
/// the coupon document already exists in `coupons`, written by `spinWheel`, so
/// there is nothing here to save.
class SpinResultSheet extends StatefulWidget {
  const SpinResultSheet({
    super.key,
    required this.result,
    required this.spinsRemaining,
    required this.onSpinAgain,
    required this.onSaveToCoupons,
  });

  final SpinResult result;

  /// Re-read from the server after the spin — never a local decrement.
  final int spinsRemaining;
  final VoidCallback onSpinAgain;
  final VoidCallback onSaveToCoupons;

  /// Opens the sheet. Returns once it is dismissed.
  static Future<void> show(
    BuildContext context, {
    required SpinResult result,
    required int spinsRemaining,
    required VoidCallback onSpinAgain,
    required VoidCallback onSaveToCoupons,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppDimens.radiusXl),
        ),
      ),
      builder: (_) => SpinResultSheet(
        result: result,
        spinsRemaining: spinsRemaining,
        onSpinAgain: onSpinAgain,
        onSaveToCoupons: onSaveToCoupons,
      ),
    );
  }

  @override
  State<SpinResultSheet> createState() => _SpinResultSheetState();
}

class _SpinResultSheetState extends State<SpinResultSheet> {
  late final ConfettiController _confetti;

  @override
  void initState() {
    super.initState();
    _confetti = ConfettiController(duration: const Duration(seconds: 2));
    // Losses get no celebration — the spin still counted, and pretending
    // otherwise reads as mockery.
    if (widget.result.isWin) _confetti.play();
  }

  @override
  void dispose() {
    _confetti.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final coupon = result.coupon;
    final isWin = result.isWin;

    return Stack(
      alignment: Alignment.topCenter,
      children: [
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppDimens.screenPadding,
              AppDimens.space20,
              AppDimens.screenPadding,
              AppDimens.space20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: isWin ? AppColors.cta : AppColors.subtle,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isWin
                        ? Icons.card_giftcard_rounded
                        : Icons.sentiment_neutral_rounded,
                    size: 38,
                    color: isWin ? AppColors.textPrimary : AppColors.muted,
                  ),
                ),
                const SizedBox(height: AppDimens.space16),

                if (isWin) ...[
                  const Text(
                    'YOU WON',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppColors.goldStrong,
                    ),
                  ),
                  const SizedBox(height: AppDimens.space6),
                ],

                Text(
                  isWin ? result.rewardText : 'Better luck next time',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    color: AppColors.textPrimary,
                  ),
                ),

                if (_conditionsLine(coupon) != null) ...[
                  const SizedBox(height: AppDimens.space8),
                  Text(
                    _conditionsLine(coupon)!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],

                if (!isWin) ...[
                  const SizedBox(height: AppDimens.space8),
                  const Text(
                    'That spin has been used. Try your luck again.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],

                if (isWin && result.couponCode.isNotEmpty) ...[
                  const SizedBox(height: AppDimens.space20),
                  CouponCodeBox(code: result.couponCode),
                ],

                const SizedBox(height: AppDimens.space24),

                if (isWin)
                  CustomButton(
                    label: 'Save to coupons',
                    onPressed: widget.onSaveToCoupons,
                  ),

                if (widget.spinsRemaining > 0) ...[
                  if (isWin) const SizedBox(height: AppDimens.space10),
                  CustomButton(
                    label: 'Spin again (${widget.spinsRemaining} left)',
                    variant: ButtonVariant.outline,
                    onPressed: widget.onSpinAgain,
                  ),
                ] else if (!isWin) ...[
                  CustomButton(
                    label: 'Done',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ],
            ),
          ),
        ),

        // Emits downward from the top edge of the sheet.
        ConfettiWidget(
          confettiController: _confetti,
          blastDirection: math.pi / 2,
          emissionFrequency: 0.05,
          numberOfParticles: 14,
          maxBlastForce: 18,
          minBlastForce: 8,
          gravity: 0.25,
          shouldLoop: false,
          colors: const [
            AppColors.cta,
            AppColors.goldStrong,
            AppColors.brandGreen,
            AppColors.semanticSuccess,
          ],
        ),
      ],
    );
  }

  /// "Min order ₹50 · expires in 3 days" — each half omitted when it doesn't
  /// apply. The expiry comes from the coupon the SERVER minted, so a campaign
  /// with any validity window (including a 1-hour one) reads correctly.
  String? _conditionsLine(SpinRewardCoupon? coupon) {
    if (coupon == null) return null;
    final parts = <String>[];
    if (coupon.minimumOrderAmount > 0) {
      parts.add('Min order ₹${formatMoney(coupon.minimumOrderAmount)}');
    }
    final expiry = coupon.expiresInLabel();
    if (expiry != null) parts.add(expiry);
    return parts.isEmpty ? null : parts.join(' · ');
  }
}
