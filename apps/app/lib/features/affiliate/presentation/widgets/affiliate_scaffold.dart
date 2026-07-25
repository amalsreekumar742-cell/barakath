import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/domain/entities/user.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

/// The circular back button + 20/800 title header every affiliate screen wears
/// (design frames 27–30, 39).
PreferredSizeWidget affiliateAppBar(
  BuildContext context, {
  required String title,
  Widget? trailing,
}) {
  return AppBar(
    backgroundColor: AppColors.background,
    elevation: 0,
    titleSpacing: 12,
    leadingWidth: 74,
    leading: Center(
      child: GestureDetector(
        onTap: () => context.canPop() ? context.pop() : context.go('/profile'),
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 40,
          height: 40,
          margin: const EdgeInsets.only(left: AppDimens.space20),
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
      if (trailing != null) ...[
        trailing,
        const SizedBox(width: AppDimens.space20),
      ],
    ],
  );
}

/// The "ALLOCATED" pill beside the dashboard title (design frame 27).
class AffiliateBadge extends StatelessWidget {
  const AffiliateBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.brandGreenSubtle,
        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
      ),
      child: const Text(
        'ALLOCATED',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
          color: AppColors.brandGreen,
        ),
      ),
    );
  }
}

/// Access gate for every affiliate screen (spec §2.22 — these surfaces exist
/// only for an allocated affiliate).
///
/// * Not an affiliate (empty `affiliateCode`) → back to `/profile`.
/// * [requireWalletAccess] and `affiliateEnabled == false` → back to the
///   dashboard, which explains that wallet access is switched off. Admin owns
///   that toggle, so the dashboard is the honest place to say so.
///
/// The redirect is scheduled post-frame (you cannot navigate during a build)
/// and fired once, so a rebuild while the pop animation runs can't stack routes.
class AffiliateGuard extends StatefulWidget {
  const AffiliateGuard({
    super.key,
    required this.builder,
    this.requireWalletAccess = false,
  });

  final Widget Function(BuildContext context, User user) builder;
  final bool requireWalletAccess;

  @override
  State<AffiliateGuard> createState() => _AffiliateGuardState();
}

class _AffiliateGuardState extends State<AffiliateGuard> {
  bool _redirected = false;

  void _redirectTo(String location) {
    if (_redirected) return;
    _redirected = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.go(location);
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;

    // Auth still resolving — a shimmer, never a bounce to /profile on a user we
    // simply haven't loaded yet.
    if (auth.isLoading || (user == null && auth.isAuthenticated)) {
      return const AffiliateLoadingBody();
    }

    if (user == null || !user.isAffiliate) {
      _redirectTo('/profile');
      return const AffiliateLoadingBody();
    }

    if (widget.requireWalletAccess && !user.affiliateEnabled) {
      _redirectTo('/affiliate');
      return const AffiliateLoadingBody();
    }

    return widget.builder(context, user);
  }
}

/// Shimmer placeholder used while auth resolves or a redirect is in flight.
class AffiliateLoadingBody extends StatelessWidget {
  const AffiliateLoadingBody({super.key});

  @override
  Widget build(BuildContext context) {
    return ShimmerLoading(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppDimens.screenPadding,
          AppDimens.space12,
          AppDimens.screenPadding,
          AppDimens.space24,
        ),
        physics: const NeverScrollableScrollPhysics(),
        children: const [
          ShimmerBox(width: double.infinity, height: 118, borderRadius: 16),
          SizedBox(height: AppDimens.gapCards),
          ShimmerBox(width: double.infinity, height: 78, borderRadius: 12),
          SizedBox(height: AppDimens.gapCards),
          ShimmerBox(width: double.infinity, height: 132, borderRadius: 12),
          SizedBox(height: AppDimens.gapCards),
          ShimmerBox(width: double.infinity, height: 52, borderRadius: 8),
        ],
      ),
    );
  }
}
