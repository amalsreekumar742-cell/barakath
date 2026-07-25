import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../widgets/profile_app_bar.dart';

/// Help centre (frame `35 · Help & support`): Call, WhatsApp and Email, read
/// from `general/config`.
///
/// NO support hours line. The prototype shows "Our team is here 9am–9pm, every
/// day" but spec §2.21 says no support hours are displayed (design map §4
/// row 2) — the store has not promised a window.
class HelpCentrePage extends StatefulWidget {
  const HelpCentrePage({super.key});

  @override
  State<HelpCentrePage> createState() => _HelpCentrePageState();
}

class _HelpCentrePageState extends State<HelpCentrePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final settings = context.read<GeneralSettingsProvider>();
      if (!settings.loadedOnce && !settings.isLoading) settings.load();
    });
  }

  /// Hand off to the dialler / WhatsApp / mail client. A device with no handler
  /// for the scheme (a tablet without telephony, no WhatsApp installed) throws
  /// or returns false — both mean "tell the customer", never a silent no-op.
  Future<void> _launch(Uri uri, String failureMessage) async {
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) AppToast.error(context, failureMessage);
    } catch (_) {
      if (mounted) AppToast.error(context, failureMessage);
    }
  }

  /// wa.me needs a bare international number — no '+', spaces or dashes.
  String _whatsappDigits(String raw) => raw.replaceAll(RegExp(r'\D'), '');

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<GeneralSettingsProvider>();
    final isLoading = settings.isLoading || !settings.loadedOnce;

    final phone = settings.helpPhone.trim();
    final whatsapp = settings.helpWhatsApp.trim();
    final email = settings.helpEmail.trim();
    final hasAnyContact =
        phone.isNotEmpty || whatsapp.isNotEmpty || email.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const ProfileAppBar(title: 'Help centre'),
      body: isLoading
          ? const _HelpShimmer()
          : !hasAnyContact
              ? const EmptyState(
                  icon: Icons.support_agent_outlined,
                  title: 'Support contacts are not available right now',
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(
                    AppDimens.screenPadding,
                    AppDimens.space4,
                    AppDimens.screenPadding,
                    AppDimens.space24,
                  ),
                  children: [
                    const Text(
                      'Contact us',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: AppDimens.space16),
                    if (phone.isNotEmpty) ...[
                      _ContactTile(
                        icon: Icons.call_outlined,
                        iconColor: AppColors.brandGreen,
                        title: 'Call us',
                        subtitle: phone,
                        onTap: () => _launch(
                          Uri(scheme: 'tel', path: phone),
                          'Could not open the dialler.',
                        ),
                      ),
                      const SizedBox(height: AppDimens.gapCards),
                    ],
                    if (whatsapp.isNotEmpty) ...[
                      _ContactTile(
                        icon: Icons.chat_bubble_outline_rounded,
                        iconColor: AppColors.semanticSuccess,
                        title: 'WhatsApp',
                        subtitle: 'Chat with support',
                        onTap: () => _launch(
                          Uri.parse('https://wa.me/${_whatsappDigits(whatsapp)}'),
                          'Could not open WhatsApp.',
                        ),
                      ),
                      const SizedBox(height: AppDimens.gapCards),
                    ],
                    if (email.isNotEmpty)
                      _ContactTile(
                        icon: Icons.mail_outline_rounded,
                        iconColor: AppColors.goldStrong,
                        title: 'Email',
                        subtitle: email,
                        onTap: () => _launch(
                          Uri(scheme: 'mailto', path: email),
                          'Could not open your mail app.',
                        ),
                      ),
                  ],
                ),
    );
  }
}

/// One contact row: coloured 44px icon tile, title, subtitle, chevron.
class _ContactTile extends StatelessWidget {
  const _ContactTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radiusCard),
      child: Container(
        padding: const EdgeInsets.all(AppDimens.space16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusCard),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: iconColor,
                borderRadius: BorderRadius.circular(AppDimens.radiusCard),
              ),
              child: Icon(icon, size: 20, color: Colors.white),
            ),
            const SizedBox(width: AppDimens.space14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
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

class _HelpShimmer extends StatelessWidget {
  const _HelpShimmer();

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: AppDimens.space8),
            ShimmerBox(width: 90, height: 12),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 76, borderRadius: 12),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 76, borderRadius: 12),
            SizedBox(height: AppDimens.gapCards),
            ShimmerBox(width: double.infinity, height: 76, borderRadius: 12),
          ],
        ),
      ),
    );
  }
}
