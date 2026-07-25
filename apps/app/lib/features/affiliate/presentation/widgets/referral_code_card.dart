import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';

/// The referral-code card: the code in large monospace, Copy (clipboard +
/// toast) and Share (spec §2.22 "referral code (Copy + Share)").
///
/// The invite text carries the CODE, not a bare link — the app has no deep-link
/// handler yet, and a friend types the code into the signup field, so the code
/// is the part that has to survive being pasted anywhere.
class ReferralCodeCard extends StatelessWidget {
  const ReferralCodeCard({super.key, required this.code});

  final String code;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: code));
    if (!context.mounted) return;
    AppToast.success(context, 'Referral code copied');
  }

  Future<void> _share(BuildContext context) async {
    await Share.share(
      'Shop with ${AppDetails.appName} and use my referral code $code '
      'when you sign up.',
      subject: 'My ${AppDetails.appName} referral code',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppDimens.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Your referral code',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () => _copy(context),
                icon: const Icon(Icons.copy_rounded, size: 16),
                label: const Text('Copy'),
              ),
            ],
          ),
          const SizedBox(height: AppDimens.space8),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppDimens.space14,
                    vertical: AppDimens.space12,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandGreenSubtle,
                    borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      code,
                      style: const TextStyle(
                        // Monospace so O/0 and I/1 can't be misread when a
                        // customer reads the code out loud.
                        fontFamily: 'monospace',
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.5,
                        color: AppColors.brandGreen,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppDimens.space10),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: () => _share(context),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppDimens.space16,
                    ),
                    minimumSize: const Size(0, 48),
                  ),
                  child: const Text('Share'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppDimens.space10),
          const Text(
            'You earn a fixed commission every time someone shops with your '
            'code. It clears after 7 days, then admin confirms it.',
            style: TextStyle(
              fontSize: 12,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
