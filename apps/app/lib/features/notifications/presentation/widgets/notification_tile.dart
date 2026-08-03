import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../domain/entities/app_notification.dart';

/// One row in the notification feed (design frame `34 · Notifications`).
///
/// Unread is signalled three ways, because one is never enough on a glanceable
/// list: a tinted card instead of a bordered white one, a semibold title, and a
/// small dot on the trailing edge, just past the timestamp. The dot's slot is
/// reserved even when read, so the two states line up instead of jittering as
/// rows are opened.
class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    required this.notification,
    required this.isRead,
    required this.onTap,
  });

  final AppNotification notification;
  final bool isRead;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = !isRead;
    final visual = _NotificationVisual.forType(notification.type);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      child: Container(
        padding: const EdgeInsets.all(AppDimens.cardPadding),
        decoration: BoxDecoration(
          color: unread ? AppColors.brandGreenSubtle : AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          border: Border.all(
            color: unread ? Colors.transparent : AppColors.hairline,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: visual.background,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
              ),
              child: Icon(visual.icon, size: 20, color: visual.foreground),
            ),
            const SizedBox(width: AppDimens.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight:
                                unread ? FontWeight.w800 : FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppDimens.space8),
                      Text(
                        relativeTime(notification.createdAt),
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textFaint,
                        ),
                      ),
                    ],
                  ),
                  if (notification.body.trim().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      notification.body,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Reserved dot slot — coloured only when unread.
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6, left: AppDimens.space8),
              decoration: BoxDecoration(
                color: unread ? AppColors.brandGreen : Colors.transparent,
                shape: BoxShape.circle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// "2h", "Yesterday", "12 Mar" — short enough to sit beside the title.
///
/// WHY not a plain `DateFormat`: "12 Mar 09:41" tells a customer nothing about
/// an order update that landed four minutes ago. Absolute dates only take over
/// once the relative form stops being useful.
String relativeTime(DateTime? timestamp) {
  if (timestamp == null) return '';

  final now = DateTime.now();
  final diff = now.difference(timestamp);

  if (diff.isNegative) return 'Just now'; // clock skew on a server timestamp
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (diff.inHours < 24) return '${diff.inHours}h';

  final today = DateTime(now.year, now.month, now.day);
  final that = DateTime(timestamp.year, timestamp.month, timestamp.day);
  final days = today.difference(that).inDays;

  if (days == 1) return 'Yesterday';
  if (days < 7) return '${days}d';
  if (timestamp.year == now.year) return DateFormat('d MMM').format(timestamp);
  return DateFormat('d MMM yyyy').format(timestamp);
}

/// Icon + colours per notification `type` ('Broadcast' | 'Order' | 'Promotion' |
/// 'Wallet' | 'Affiliate' | 'Replacement' | 'System').
class _NotificationVisual {
  const _NotificationVisual({
    required this.icon,
    required this.background,
    required this.foreground,
  });

  final IconData icon;
  final Color background;
  final Color foreground;

  static _NotificationVisual forType(String type) {
    switch (type.trim().toLowerCase()) {
      case 'order':
        return const _NotificationVisual(
          icon: Icons.local_shipping_outlined,
          background: AppColors.brandGreen,
          foreground: Colors.white,
        );
      case 'promotion':
        return const _NotificationVisual(
          icon: Icons.card_giftcard_rounded,
          background: AppColors.goldSubtle,
          foreground: AppColors.goldStrong,
        );
      case 'wallet':
        return const _NotificationVisual(
          icon: Icons.account_balance_wallet_outlined,
          background: AppColors.semanticSuccessSubtle,
          foreground: AppColors.semanticSuccess,
        );
      case 'affiliate':
        return const _NotificationVisual(
          icon: Icons.people_alt_outlined,
          background: AppColors.goldSubtle,
          foreground: AppColors.goldStrong,
        );
      case 'replacement':
        return const _NotificationVisual(
          icon: Icons.swap_horiz_rounded,
          background: AppColors.surfaceSubtle,
          foreground: AppColors.textSecondary,
        );
      default: // Broadcast / System / anything a newer admin build introduces
        return const _NotificationVisual(
          icon: Icons.notifications_none_rounded,
          background: AppColors.brandGreenSubtle,
          foreground: AppColors.brandGreen,
        );
    }
  }
}
