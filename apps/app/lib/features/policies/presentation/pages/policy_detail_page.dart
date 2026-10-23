import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/html_content_view.dart';
import '../../../profile/presentation/widgets/profile_app_bar.dart';
import '../../domain/entities/policy.dart';
import '../providers/policies_provider.dart';
import '../widgets/policy_shimmers.dart';

/// One policy (`policies/{policyId}`): the admin's rich text through
/// [HtmlContentView], under a "Last updated" line.
///
/// Reached from the Policies list, and directly by the legacy
/// `/profile/privacy` and `/profile/terms` routes, which pass the fixed ids of
/// the two policies migrated from `general/config`
/// (`FirebaseCollections.privacyPolicyId` / `termsAndConditionsId`).
class PolicyDetailPage extends StatefulWidget {
  const PolicyDetailPage({
    super.key,
    required this.policyId,
    this.fallbackTitle = 'Policy',
  });

  final String policyId;

  /// App-bar title until the policy's own name is known (and when it turns out
  /// to be unavailable). The legacy routes pass "Privacy policy" / "Terms &
  /// conditions" so the header reads right from the first frame.
  final String fallbackTitle;

  @override
  State<PolicyDetailPage> createState() => _PolicyDetailPageState();
}

class _PolicyDetailPageState extends State<PolicyDetailPage> {
  @override
  void initState() {
    super.initState();
    // Post-frame: loading notifies listeners, which must not happen mid-build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<PoliciesProvider>().loadPolicy(widget.policyId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PoliciesProvider>();
    final state = provider.detailStateOf(widget.policyId);
    final policy = provider.detailOf(widget.policyId);
    final name = policy?.name.trim() ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: ProfileAppBar(title: name.isNotEmpty ? name : widget.fallbackTitle),
      body: switch (state) {
        PolicyDetailState.initial ||
        PolicyDetailState.loading =>
          const PolicyDocumentShimmer(),
        PolicyDetailState.error => ErrorState(
            message: provider.detailErrorOf(widget.policyId) ??
                'Could not load this policy.',
            onRetry: () => provider.loadPolicy(widget.policyId),
          ),
        PolicyDetailState.notFound => const EmptyState(
            icon: Icons.description_outlined,
            title: 'This policy is not available',
            subtitle: 'It may have been removed, or it has not been published yet.',
          ),
        PolicyDetailState.loaded => policy == null
            ? const PolicyDocumentShimmer()
            : _PolicyDocument(policy: policy),
      },
    );
  }
}

class _PolicyDocument extends StatelessWidget {
  const _PolicyDocument({required this.policy});

  final Policy policy;

  @override
  Widget build(BuildContext context) {
    final html = policy.content.trim();
    // The admin can create a policy before writing it. Never fake legal copy —
    // placeholder text on a terms page would be actively misleading.
    if (html.isEmpty) {
      return const EmptyState(
        icon: Icons.description_outlined,
        title: 'This policy has not been published yet',
      );
    }

    final updatedAt = policy.updatedAt;
    return Column(
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
    );
  }
}
