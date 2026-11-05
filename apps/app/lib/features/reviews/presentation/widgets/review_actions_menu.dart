import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../profile/presentation/widgets/confirm_dialog.dart';
import '../../../../core/widgets/login_prompt_sheet.dart';
import '../../domain/entities/review.dart';
import '../providers/review_moderation_provider.dart';

enum _ReviewAction { report, block }

const _reportReasons = [
  'Offensive or abusive',
  'Inappropriate photo',
  'Spam or fake',
  'Something else',
];

/// The "⋮" on a review: report it, or block the customer who wrote it. Not shown
/// on the customer's own review.
class ReviewActionsMenu extends StatelessWidget {
  const ReviewActionsMenu({super.key, required this.review});

  final Review review;

  @override
  Widget build(BuildContext context) {
    final moderation = context.read<ReviewModerationProvider>();
    if (moderation.currentUid == review.userId) return const SizedBox.shrink();

    return SizedBox(
      width: 28,
      height: 20,
      child: PopupMenuButton<_ReviewAction>(
        padding: EdgeInsets.zero,
        iconSize: 18,
        tooltip: 'Review options',
        icon: const Icon(Icons.more_vert, color: AppColors.textFaint),
        color: AppColors.surface,
        onSelected: (action) => _onSelected(context, action),
        itemBuilder: (_) => const [
          PopupMenuItem(
              value: _ReviewAction.report, child: Text('Report review')),
          PopupMenuItem(
              value: _ReviewAction.block, child: Text('Block this customer')),
        ],
      ),
    );
  }

  Future<void> _onSelected(BuildContext context, _ReviewAction action) async {
    if (!context.read<AuthProvider>().isAuthenticated) {
      await showLoginPromptSheet(context);
      return;
    }
    switch (action) {
      case _ReviewAction.report:
        await _report(context);
      case _ReviewAction.block:
        await _block(context);
    }
  }

  Future<void> _report(BuildContext context) async {
    final moderation = context.read<ReviewModerationProvider>();
    final reason = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text(
                'Why are you reporting this review?',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text('Our team reviews every report within 24 hours.'),
            ),
            for (final reason in _reportReasons)
              ListTile(
                title: Text(reason),
                onTap: () => Navigator.of(sheet).pop(reason),
              ),
          ],
        ),
      ),
    );
    if (reason == null) return;

    final error = await moderation.report(review, reason);
    if (!context.mounted) return;
    if (error != null) {
      AppToast.error(context, error);
    } else {
      AppToast.success(context, 'Thanks. We will review this report.');
    }
  }

  Future<void> _block(BuildContext context) async {
    final moderation = context.read<ReviewModerationProvider>();
    final confirmed = await showConfirmDialog(
      context,
      title: 'Block this customer?',
      message: 'You will no longer see their reviews.',
      confirmLabel: 'Block',
      destructive: true,
    );
    if (!confirmed) return;

    final error = await moderation.block(review);
    if (!context.mounted) return;
    if (error != null) {
      AppToast.error(context, error);
    } else {
      AppToast.success(context, 'Customer blocked');
    }
  }
}
