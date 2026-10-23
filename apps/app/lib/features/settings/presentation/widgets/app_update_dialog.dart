import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';

/// The app-update prompt raised by the splash gate (spec §2.1, §2.25 "Force
/// update mechanism").
///
/// [isRequired] → "Update required": non-dismissible, the only action opens the
/// store, and the dialog stays up when the customer comes back without updating.
/// Otherwise → "Update available": "Later" or "Update", either one closes it.
class AppUpdateDialog extends StatelessWidget {
  const AppUpdateDialog({
    super.key,
    required this.isRequired,
    required this.storeUrl,
  });

  final bool isRequired;
  final String storeUrl;

  /// Show the dialog; completes when it closes (never, for a required update).
  static Future<void> show(
    BuildContext context, {
    required bool isRequired,
    required String storeUrl,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: !isRequired,
      builder: (_) => AppUpdateDialog(isRequired: isRequired, storeUrl: storeUrl),
    );
  }

  Future<void> _openStore() async {
    final uri = Uri.tryParse(storeUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !isRequired,
      child: AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: Text(
          isRequired ? 'Update required' : 'Update available',
          style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
        ),
        content: Text(
          isRequired
              ? 'A newer version of Barakath is available. Please update to continue.'
              : 'A newer version of Barakath is available with the latest improvements.',
          style: const TextStyle(color: AppColors.inkSoft, height: 1.4),
        ),
        actions: [
          if (isRequired)
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _openStore,
                child: const Text('Update now'),
              ),
            )
          else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Later'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      _openStore();
                    },
                    child: const Text('Update'),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
