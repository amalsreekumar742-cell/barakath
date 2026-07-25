import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/login_prompt_sheet.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/profile_provider.dart';
import '../widgets/affiliate_banner.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/profile_avatar.dart';
import '../widgets/profile_menu_card.dart';
import '../widgets/profile_shimmer.dart';

/// Profile tab (spec §2.4: profile requires login; §2.21 for the contents).
///
/// A guest sees the login prompt; a signed-in customer sees their avatar, name
/// and email, the affiliate strip (affiliates only), the two menu groups and a
/// destructive log out.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startMirror());
  }

  /// Point ProfileProvider at the signed-in uid. Idempotent inside the provider,
  /// so a rebuild cannot open a second listener.
  void _startMirror() {
    if (!mounted) return;
    final uid = context.read<AuthProvider>().currentUser?.id;
    if (uid != null && uid.isNotEmpty) {
      context.read<ProfileProvider>().init(uid);
    }
  }

  bool _isGuest(BuildContext context) {
    try {
      final auth = context.read<AuthProvider>();
      return auth.isGuest && !auth.isAuthenticated;
    } catch (_) {
      return false;
    }
  }

  Future<void> _confirmLogout() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Log out?',
      message: "You'll need to sign in again with your mobile number to "
          'access your account.',
      confirmLabel: 'Log out',
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    final router = GoRouter.of(context);
    await context.read<ProfileProvider>().logout();
    if (!mounted) return;

    AppToast.success(context, 'Logged out');
    // `go` replaces the whole stack — a back gesture must not land inside the
    // account of the customer who just signed out.
    router.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final isGuest = _isGuest(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        title: const Text(
          'Profile',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: isGuest ? _guestBody(context) : _customerBody(context),
    );
  }

  Widget _guestBody(BuildContext context) {
    return EmptyState(
      icon: Icons.person_outline,
      title: 'Login to view your profile',
      subtitle: 'Sign in to manage your account, orders and settings.',
      actionLabel: 'Login',
      onAction: () => showLoginPromptSheet(context),
    );
  }

  Widget _customerBody(BuildContext context) {
    final profile = context.watch<ProfileProvider>();
    final user = profile.user;

    if (profile.isLoading || user == null) return const ProfileShimmer();

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        _Header(user: user),
        const SizedBox(height: AppDimens.space16),
        if (profile.isAffiliate) ...[
          AffiliateBanner(
            withdrawable: user.affiliateBalance,
            totalReferrals: user.totalReferrals,
            onTap: () => context.push('/affiliate'),
          ),
          const SizedBox(height: AppDimens.space16),
        ],
        ProfileMenuCard(
          entries: [
            ProfileMenuEntry(
              icon: Icons.shopping_bag_outlined,
              label: 'My orders',
              onTap: () => context.push('/orders'),
            ),
            ProfileMenuEntry(
              icon: Icons.favorite_border_rounded,
              label: 'Wishlist',
              onTap: () => context.push('/wishlist'),
            ),
            ProfileMenuEntry(
              icon: Icons.location_on_outlined,
              label: 'Saved addresses',
              onTap: () => context.push('/saved-addresses'),
            ),
            ProfileMenuEntry(
              icon: Icons.card_giftcard_rounded,
              label: 'Spin & Win',
              onTap: () => context.push('/spin'),
            ),
          ],
        ),
        const SizedBox(height: AppDimens.space16),
        ProfileMenuCard(
          entries: [
            ProfileMenuEntry(
              icon: Icons.notifications_none_rounded,
              label: 'Notifications',
              onTap: () => context.push('/notifications'),
            ),
            ProfileMenuEntry(
              icon: Icons.mail_outline_rounded,
              label: 'Help & support',
              onTap: () => context.push('/profile/help'),
            ),
            ProfileMenuEntry(
              icon: Icons.settings_outlined,
              label: 'Settings',
              iconColor: AppColors.textSecondary,
              onTap: () => context.push('/profile/settings'),
            ),
          ],
        ),
        const SizedBox(height: AppDimens.space8),
        _LogOutRow(onTap: _confirmLogout),
      ],
    );
  }
}

/// Avatar, name, email and the pencil that opens Edit profile.
class _Header extends StatelessWidget {
  const _Header({required this.user});

  final User user;

  @override
  Widget build(BuildContext context) {
    final hasName = user.fullName.trim().isNotEmpty;
    final hasEmail = user.email.trim().isNotEmpty;

    return Row(
      children: [
        ProfileAvatar(imageUrl: user.profileImage, fullName: user.fullName),
        const SizedBox(width: AppDimens.space14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                hasName ? user.fullName : 'Add your name',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                  color: hasName ? AppColors.textPrimary : AppColors.textFaint,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                hasEmail ? user.email : user.phone,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppDimens.space8),
        IconButton(
          onPressed: () => context.push('/profile/edit'),
          icon: const Icon(Icons.edit_outlined, size: 20),
          color: AppColors.brandGreen,
          tooltip: 'Edit profile',
        ),
      ],
    );
  }
}

/// The destructive footer action from frame `36 · Profile`.
class _LogOutRow extends StatelessWidget {
  const _LogOutRow({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      child: const Padding(
        padding: EdgeInsets.symmetric(vertical: AppDimens.space14),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.logout_rounded, size: 18, color: AppColors.statusError),
            SizedBox(width: AppDimens.space8),
            Text(
              'Log out',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.statusError,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
