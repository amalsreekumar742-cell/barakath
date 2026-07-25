import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../cart/presentation/providers/cart_provider.dart';
import '../providers/profile_provider.dart';
import '../widgets/confirm_dialog.dart';
import '../widgets/identity_form.dart';
import '../widgets/profile_app_bar.dart';
import '../widgets/profile_menu_card.dart';

/// Settings (frame `37 · Settings & personal info`): the editable identity
/// block, the two legal documents, and account deletion.
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final uid = context.read<AuthProvider>().currentUser?.id;
      if (uid != null && uid.isNotEmpty) {
        context.read<ProfileProvider>().init(uid);
      }
    });
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Delete your account?',
      message: 'This permanently removes your name, email, photo and saved '
          'wishlist, and signs you out on every device. You will not be able '
          'to sign back in with this number. This cannot be undone.',
      confirmLabel: 'Delete account',
      cancelLabel: 'Keep my account',
      destructive: true,
    );
    if (!confirmed || !mounted) return;

    final router = GoRouter.of(context);
    final cart = context.read<CartProvider>();

    final error = await context.read<ProfileProvider>().deleteAccount();
    if (!mounted) return;
    if (error != null) {
      AppToast.error(context, error);
      return;
    }

    // The bag lives on-device, so it survives sign-out unless it is cleared
    // here — the next person to open the app must not inherit it.
    cart.clearCart();

    AppToast.success(context, 'Your account has been deleted');
    router.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<ProfileProvider>();
    final user = profile.user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const ProfileAppBar(title: 'Settings'),
      body: profile.isLoading || user == null
          ? const _SettingsShimmer()
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                AppDimens.space4,
                AppDimens.screenPadding,
                AppDimens.space24,
              ),
              children: [
                const _SectionLabel('Personal information'),
                const SizedBox(height: AppDimens.space12),
                IdentityForm(
                  user: user,
                  nameLabel: 'Full name',
                  whatsappLabel: 'WhatsApp',
                  emailLabel: 'Email',
                  saveLabel: 'Save changes',
                ),
                const SizedBox(height: AppDimens.gapSections),
                const _SectionLabel('Legal'),
                const SizedBox(height: AppDimens.space12),
                ProfileMenuCard(
                  entries: [
                    ProfileMenuEntry(
                      icon: Icons.privacy_tip_outlined,
                      label: 'Privacy policy',
                      onTap: () => context.push('/profile/privacy'),
                    ),
                    ProfileMenuEntry(
                      icon: Icons.gavel_rounded,
                      label: 'Terms & conditions',
                      onTap: () => context.push('/profile/terms'),
                    ),
                  ],
                ),
                const SizedBox(height: AppDimens.gapSections),
                _DeleteAccountRow(
                  isDeleting: profile.isDeleting,
                  onTap: profile.isDeleting ? null : _confirmDelete,
                ),
              ],
            ),
    );
  }
}

/// The uppercase section header from the design (12/800, tertiary).
class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w800,
        letterSpacing: 0.6,
        color: AppColors.textFaint,
      ),
    );
  }
}

class _DeleteAccountRow extends StatelessWidget {
  const _DeleteAccountRow({required this.isDeleting, required this.onTap});

  final bool isDeleting;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppDimens.space14),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isDeleting)
              const SizedBox(
                height: 16,
                width: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor:
                      AlwaysStoppedAnimation<Color>(AppColors.statusError),
                ),
              )
            else
              const Icon(
                Icons.delete_outline_rounded,
                size: 18,
                color: AppColors.statusError,
              ),
            const SizedBox(width: AppDimens.space8),
            const Text(
              'Delete account',
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

class _SettingsShimmer extends StatelessWidget {
  const _SettingsShimmer();

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: AppDimens.space8),
            ShimmerBox(width: 150, height: 12),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
            SizedBox(height: AppDimens.gapSections),
            ShimmerBox(width: 80, height: 12),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 104, borderRadius: 12),
          ],
        ),
      ),
    );
  }
}
