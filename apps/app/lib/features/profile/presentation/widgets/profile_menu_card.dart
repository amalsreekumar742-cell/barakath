import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// One row of the profile menu: leading icon, label, trailing chevron.
class ProfileMenuEntry {
  const ProfileMenuEntry({
    required this.icon,
    required this.label,
    required this.onTap,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  /// Defaults to the brand green used across the design's menu icons.
  final Color? iconColor;
}

/// The grouped menu card from frame `36 · Profile`: a white panel with a
/// hairline border and hairline separators between rows.
class ProfileMenuCard extends StatelessWidget {
  const ProfileMenuCard({super.key, required this.entries});

  final List<ProfileMenuEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusCard),
        border: Border.all(color: AppColors.hairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            _MenuRow(entry: entries[i]),
            if (i != entries.length - 1)
              const Divider(height: 1, thickness: 1, color: AppColors.hairline),
          ],
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.entry});

  final ProfileMenuEntry entry;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: entry.onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimens.space16,
          vertical: 15,
        ),
        child: Row(
          children: [
            Icon(
              entry.icon,
              size: 20,
              color: entry.iconColor ?? AppColors.brandGreen,
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: Text(
                entry.label,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.textFaint,
            ),
          ],
        ),
      ),
    );
  }
}
