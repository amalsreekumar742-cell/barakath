import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// The header every profile sub-page uses: a 42px circular back button and a
/// 20/800 title, matching the design frames (`37 · Settings`, `35 · Help`).
class ProfileAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ProfileAppBar({super.key, required this.title, this.trailing});

  final String title;

  /// Optional right-hand action (e.g. an item count).
  final Widget? trailing;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      titleSpacing: AppDimens.space12,
      leadingWidth: 74,
      backgroundColor: AppColors.background,
      elevation: 0,
      leading: Center(
        child: GestureDetector(
          onTap: () => context.canPop() ? context.pop() : context.go('/profile'),
          behavior: HitTestBehavior.opaque,
          child: Container(
            width: 42,
            height: 42,
            margin: const EdgeInsets.only(left: AppDimens.screenPadding),
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.hairline),
            ),
            child: const Icon(
              Icons.arrow_back_rounded,
              size: 20,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.4,
          color: AppColors.textPrimary,
        ),
      ),
      actions: [
        if (trailing != null)
          Padding(
            padding: const EdgeInsets.only(right: AppDimens.screenPadding),
            child: Center(child: trailing!),
          ),
      ],
    );
  }
}
