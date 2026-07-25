import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/html_content_view.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import 'profile_app_bar.dart';

/// Which slice of `general/config` a [LegalDocumentPage] renders.
enum LegalDocument { privacyPolicy, termsAndConditions }

/// Privacy policy and Terms & conditions are the same screen with a different
/// field, so they share one implementation: the admin's rich text through
/// [HtmlContentView], under a "Last updated" line.
class LegalDocumentPage extends StatefulWidget {
  const LegalDocumentPage({
    super.key,
    required this.title,
    required this.document,
  });

  final String title;
  final LegalDocument document;

  @override
  State<LegalDocumentPage> createState() => _LegalDocumentPageState();
}

class _LegalDocumentPageState extends State<LegalDocumentPage> {
  @override
  void initState() {
    super.initState();
    // `general/config` is normally fetched at splash; re-fetch only when this
    // screen is somehow reached first (deep link, cold restore).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final settings = context.read<GeneralSettingsProvider>();
      if (!settings.loadedOnce && !settings.isLoading) settings.load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<GeneralSettingsProvider>();
    final isLoading = settings.isLoading || !settings.loadedOnce;

    final html = widget.document == LegalDocument.privacyPolicy
        ? settings.privacyPolicy
        : settings.termsAndConditions;
    final updatedAt = widget.document == LegalDocument.privacyPolicy
        ? settings.settings.privacyPolicyUpdatedAt
        : settings.settings.termsUpdatedAt;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: ProfileAppBar(title: widget.title),
      body: isLoading
          ? const _LegalShimmer()
          : html.trim().isEmpty
              ? EmptyState(
                  icon: Icons.description_outlined,
                  title: '${widget.title} is not available right now',
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (updatedAt != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppDimens.screenPadding,
                          0,
                          AppDimens.screenPadding,
                          AppDimens.space12,
                        ),
                        child: Text(
                          'Last updated ${DateFormat('d MMMM yyyy').format(updatedAt)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppDimens.screenPadding,
                          0,
                          AppDimens.screenPadding,
                          AppDimens.space16,
                        ),
                        child: HtmlContentView(html: html),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _LegalShimmer extends StatelessWidget {
  const _LegalShimmer();

  @override
  Widget build(BuildContext context) {
    return const ShimmerLoading(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ShimmerBox(width: 160, height: 12),
            SizedBox(height: AppDimens.space20),
            ShimmerBox(width: 200, height: 18),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: 240, height: 12),
            SizedBox(height: AppDimens.space24),
            ShimmerBox(width: 170, height: 18),
            SizedBox(height: AppDimens.space16),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: double.infinity, height: 12),
            SizedBox(height: AppDimens.space10),
            ShimmerBox(width: 210, height: 12),
          ],
        ),
      ),
    );
  }
}
