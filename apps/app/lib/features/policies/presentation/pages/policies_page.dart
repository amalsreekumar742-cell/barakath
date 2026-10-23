import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../profile/presentation/widgets/profile_app_bar.dart';
import '../../../profile/presentation/widgets/profile_menu_card.dart';
import '../providers/policies_provider.dart';
import '../widgets/policy_shimmers.dart';

/// Settings › Policies — every policy the admin has enabled (admin Settings ›
/// Policies), in the admin's order; tapping one opens its detail page.
///
/// WHY a list instead of fixed rows: the admin can publish any number of
/// policies (privacy, terms, refund, shipping…), so hard-coding one row per
/// policy would go stale the moment a new one is added.
///
/// WHY it re-loads on every visit: this is a pushed root-navigator page, so
/// `initState` runs each time it opens — cheap freshness for content an admin
/// can change at any moment. The provider keeps the previous list on screen
/// while that refresh runs.
class PoliciesPage extends StatefulWidget {
  const PoliciesPage({super.key});

  @override
  State<PoliciesPage> createState() => _PoliciesPageState();
}

class _PoliciesPageState extends State<PoliciesPage> {
  @override
  void initState() {
    super.initState();
    // Post-frame: loading notifies listeners, which must not happen mid-build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<PoliciesProvider>().loadPolicies();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PoliciesProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const ProfileAppBar(title: 'Policies'),
      body: switch (provider.listState) {
        PoliciesListState.initial ||
        PoliciesListState.loading =>
          const PolicyListShimmer(),
        PoliciesListState.error => ErrorState(
            message: provider.listError ?? 'Could not load policies.',
            onRetry: provider.loadPolicies,
          ),
        PoliciesListState.empty => const EmptyState(
            icon: Icons.description_outlined,
            title: 'No policies published yet',
            subtitle: 'Check back soon.',
          ),
        PoliciesListState.loaded => ListView(
            padding: const EdgeInsets.fromLTRB(
              AppDimens.screenPadding,
              AppDimens.space4,
              AppDimens.screenPadding,
              AppDimens.space24,
            ),
            children: [
              ProfileMenuCard(
                entries: [
                  for (final policy in provider.policies)
                    ProfileMenuEntry(
                      icon: Icons.description_outlined,
                      label: policy.name,
                      onTap: () => context.push('/profile/policies/${policy.id}'),
                    ),
                ],
              ),
            ],
          ),
      },
    );
  }
}
