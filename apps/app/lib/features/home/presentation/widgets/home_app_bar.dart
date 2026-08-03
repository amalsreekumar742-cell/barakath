import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../profile/presentation/widgets/profile_avatar.dart';

/// The home header (Figma node 46:5325): a greeting stack on the left, the
/// notification bell and the customer's avatar on the right. Pinned so the
/// greeting and notifications stay reachable however far the customer scrolls.
class HomeAppBar extends StatelessWidget {
  const HomeAppBar({super.key, this.unreadNotifications = 0});

  /// Unread notification count driving the bell's badge. Owned by the
  /// notifications feature — 0 simply hides the dot.
  final int unreadNotifications;

  /// The design writes this transliterated; using the conventional spelling
  /// since a misspelt greeting is the first thing this audience would notice.
  static const String _greeting = 'ASSALAMU ALAIKUM';

  @override
  Widget build(BuildContext context) {
    String name = '';
    String photo = '';
    try {
      final user = context.watch<AuthProvider>().currentUser;
      name = user?.fullName.trim() ?? '';
      photo = user?.profileImage ?? '';
    } catch (_) {
      // No auth in this tree (previews) — fall back to the generic greeting.
    }
    final firstName = name.isEmpty ? '' : name.split(RegExp(r'\s+')).first;

    return SliverAppBar(
      pinned: true,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      backgroundColor: AppColors.background,
      titleSpacing: AppDimens.screenPadding,
      toolbarHeight: 64,
      title: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  _greeting,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.44,
                    color: AppColors.textFaint,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  firstName.isEmpty ? 'Welcome' : 'Hi $firstName',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.38,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          _BellButton(
            hasUnread: unreadNotifications > 0,
            onTap: () => context.push('/notifications'),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () => context.go('/profile'),
            behavior: HitTestBehavior.opaque,
            child: ProfileAvatar(imageUrl: photo, fullName: name, size: 42),
          ),
          // Tighter than the screen gutter on purpose: the avatar is a filled
          // circle with no optical padding of its own, so a full 16 leaves it
          // looking stranded from the edge.
          const SizedBox(width: AppDimens.space8),
        ],
      ),
    );
  }
}

/// 44px white circle with the bell and an unread dot (Figma node 46:5335).
class _BellButton extends StatelessWidget {
  const _BellButton({required this.hasUnread, required this.onTap});

  final bool hasUnread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Notifications',
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.surface,
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.hairline),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              const Icon(Icons.notifications_none_rounded,
                  size: 20, color: AppColors.textPrimary),
              if (hasUnread)
                Positioned(
                  top: 9,
                  right: 10,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: AppColors.cta,
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(color: AppColors.surface),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The tappable search pill that sits at the top of the home scroll area
/// (Figma node 46:5343). It's a button, not a field — typing happens on the
/// search page, which owns suggestions and history.
class HomeSearchBar extends StatelessWidget {
  const HomeSearchBar({super.key});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/search'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(9999),
          border: Border.all(color: AppColors.hairline),
        ),
        child: const Row(
          children: [
            Icon(Icons.search_rounded, size: 19, color: AppColors.textPrimary),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                'Search perfumes, books, clothing…',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 14, color: AppColors.textFaint),
              ),
            ),
            // Icon(Icons.tune_rounded, size: 18, color: AppColors.textPrimary),
          ],
        ),
      ),
    );
  }
}
