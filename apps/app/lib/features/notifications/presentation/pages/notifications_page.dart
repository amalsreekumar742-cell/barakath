import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/paginated_list_view.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../domain/entities/app_notification.dart';
import '../providers/notifications_provider.dart';
import '../utils/notification_router.dart';
import '../widgets/notification_tile.dart';

/// Notifications — `/notifications` (spec §2.21, design frame
/// `34 · Notifications`).
///
/// Merged broadcast + personal feed, grouped TODAY / EARLIER, unread marked with
/// a dot and a semibold title, read state in SharedPreferences only, tap →
/// deep link.
class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<NotificationsProvider>().load();
    });
  }

  Future<void> _open(AppNotification notification) async {
    final provider = context.read<NotificationsProvider>();
    final route = resolveNotificationRoute(notification);

    // Mark first: navigating away rebuilds this page later, and an unread dot
    // that survives a tap reads as a bug.
    await provider.markRead(notification.id);
    if (!mounted) return;
    context.push(route);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationsProvider>();
    final rows = _rows(provider.notifications);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            // Disabled at zero unread — a control that does nothing is worse
            // than no control.
            onPressed: provider.hasUnread
                ? () => context.read<NotificationsProvider>().markAllRead()
                : null,
            child: Text(
              'Mark all read',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: provider.hasUnread
                    ? AppColors.brandGreen
                    : AppColors.textFaint,
              ),
            ),
          ),
          const SizedBox(width: AppDimens.space8),
        ],
      ),
      body: PaginatedListView<Object>(
        items: rows,
        isLoading: provider.isLoading,
        isLoadingMore: provider.isLoadingMore,
        hasMore: provider.hasMore,
        onLoadMore: () => context.read<NotificationsProvider>().loadMore(),
        onRefresh: () => context.read<NotificationsProvider>().refresh(),
        error: provider.notifications.isEmpty ? provider.error : null,
        onRetry: () => context.read<NotificationsProvider>().load(),
        // Spec §2.25 — empty states are message only, no action button.
        emptyIcon: Icons.notifications_none_rounded,
        emptyTitle: 'No notifications yet',
        emptySubtitle: 'Order updates, offers and rewards will show up here.',
        separator: const SizedBox(height: AppDimens.space8),
        skeleton: const _NotificationSkeleton(),
        skeletonCount: 6,
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.space4,
          AppDimens.screenPadding,
          AppDimens.space24,
        ),
        itemBuilder: (context, row, _) {
          if (row is String) return _SectionHeader(row);
          final notification = row as AppNotification;
          return NotificationTile(
            notification: notification,
            isRead: provider.isRead(notification.id),
            onTap: () => _open(notification),
          );
        },
      ),
    );
  }

  /// Flattens the feed into header + tile rows.
  ///
  /// TODAY / EARLIER is computed against the DEVICE's calendar day, not a
  /// 24-hour window: a message from 11pm last night belongs under EARLIER at
  /// 9am, even though it is only ten hours old.
  static List<Object> _rows(List<AppNotification> notifications) {
    if (notifications.isEmpty) return const [];

    final now = DateTime.now();
    final startOfToday = DateTime(now.year, now.month, now.day);

    final today = <AppNotification>[];
    final earlier = <AppNotification>[];
    for (final n in notifications) {
      final at = n.createdAt;
      if (at != null && !at.isBefore(startOfToday)) {
        today.add(n);
      } else {
        earlier.add(n);
      }
    }

    return [
      if (today.isNotEmpty) ...['TODAY', ...today],
      if (earlier.isNotEmpty) ...['EARLIER', ...earlier],
    ];
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        top: AppDimens.space10,
        bottom: AppDimens.space4,
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.55,
          color: AppColors.textFaint,
        ),
      ),
    );
  }
}

/// A skeleton shaped like [NotificationTile] — icon square plus two text lines.
class _NotificationSkeleton extends StatelessWidget {
  const _NotificationSkeleton();

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: Container(
        padding: const EdgeInsets.all(AppDimens.cardPadding),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          border: Border.all(color: AppColors.hairline),
        ),
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ShimmerBox(width: 40, height: 40, borderRadius: 8),
            SizedBox(width: AppDimens.space12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ShimmerBox(width: 150, height: 12),
                  SizedBox(height: AppDimens.space8),
                  ShimmerBox(width: double.infinity, height: 10),
                  SizedBox(height: AppDimens.space6),
                  ShimmerBox(width: 200, height: 10),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
