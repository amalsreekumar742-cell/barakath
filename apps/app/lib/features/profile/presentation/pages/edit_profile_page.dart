import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/profile_provider.dart';
import '../widgets/identity_form.dart';
import '../widgets/profile_app_bar.dart';

/// Edit profile (design frame `Profile · Edit profile`): change photo, display
/// name, WhatsApp number and email address.
///
/// The mobile number is shown but not editable, and there is deliberately NO
/// "Friend's code" field — the prototype shows one, but `friendCode` is captured
/// at signup and consumed once for referral attribution (design map §4 row 10).
class EditProfilePage extends StatefulWidget {
  const EditProfilePage({super.key});

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  @override
  void initState() {
    super.initState();
    // Reached directly by deep link the provider may not be mirroring yet.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final uid = context.read<AuthProvider>().currentUser?.id;
      if (uid != null && uid.isNotEmpty) {
        context.read<ProfileProvider>().init(uid);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final profile = context.watch<ProfileProvider>();
    final user = profile.user;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const ProfileAppBar(title: 'Edit profile'),
      body: profile.isLoading || user == null
          ? const _EditProfileShimmer()
          : SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppDimens.screenPadding,
                AppDimens.space12,
                AppDimens.screenPadding,
                AppDimens.space24,
              ),
              child: IdentityForm(
                user: user,
                showPhoto: true,
                popOnSave: true,
              ),
            ),
    );
  }
}

class _EditProfileShimmer extends StatelessWidget {
  const _EditProfileShimmer();

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          children: [
            SizedBox(height: AppDimens.space12),
            ShimmerBox(width: 96, height: 96, borderRadius: 48),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: 100, height: 12),
            SizedBox(height: AppDimens.space24),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 68, borderRadius: 8),
          ],
        ),
      ),
    );
  }
}
