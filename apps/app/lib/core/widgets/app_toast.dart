import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';

enum _ToastKind { success, error, info }

/// The single toast (SnackBar) surface for the whole app — replaces every
/// per-page `_toast`/`_showMessage`/`_showError` and generalises the
/// affiliate feature's old `showAffiliateToast`, whose look this matches
/// exactly: floating, rounded, brand green for success, status red for error.
class AppToast {
  const AppToast._();

  static void success(BuildContext context, String message) =>
      _show(context, message, _ToastKind.success);

  static void error(BuildContext context, String message) =>
      _show(context, message, _ToastKind.error);

  /// Neutral, non-outcome instruction ("OTP sent again"). Use sparingly.
  static void info(BuildContext context, String message) =>
      _show(context, message, _ToastKind.info);

  /// The common `_toast(error ?? 'fixed success string')` shape, split so each
  /// branch gets the right colour instead of flattening both to one.
  static void result(
    BuildContext context, {
    required String? error,
    required String successMessage,
  }) {
    if (error != null) {
      AppToast.error(context, error);
    } else {
      AppToast.success(context, successMessage);
    }
  }

  static void _show(BuildContext context, String message, _ToastKind kind) {
    final background = switch (kind) {
      _ToastKind.success => AppColors.brandGreen,
      _ToastKind.error => AppColors.statusError,
      _ToastKind.info => AppColors.ink,
    };
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: background,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDimens.radiusMd),
          ),
        ),
      );
  }
}
