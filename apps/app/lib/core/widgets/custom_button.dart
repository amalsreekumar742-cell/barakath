import 'package:flutter/material.dart';

import '../constants/app_colors.dart';

/// Visual variants for [CustomButton].
enum ButtonVariant {
  /// The design's CTA: mustard-gold fill (`brand/gold #DAA227`) with a black
  /// label, straight from the theme — do NOT re-colour it here. Every other
  /// primary action in the app is a raw [ElevatedButton] picking up the same
  /// theme, and overriding it was what made "Add to bag" render black.
  primary,

  /// Outlined (hairline border, transparent fill) button.
  outline,

  /// Filled red destructive button.
  danger,
}

/// The app's standard button. Full-width by default (min height 52) to match
/// the theme's button sizing.
///
/// Shows a small [CircularProgressIndicator] while [isLoading]. The button is
/// disabled when [isLoading], [isDisabled], or [onPressed] is null.
class CustomButton extends StatelessWidget {
  const CustomButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.isDisabled = false,
    this.variant = ButtonVariant.primary,
    this.icon,
    this.fullWidth = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isDisabled;
  final ButtonVariant variant;
  final IconData? icon;
  final bool fullWidth;

  bool get _disabled => isLoading || isDisabled || onPressed == null;

  @override
  Widget build(BuildContext context) {
    final effectiveOnPressed = _disabled ? null : onPressed;
    final child = _buildContent();

    final Widget button;
    switch (variant) {
      case ButtonVariant.primary:
        // Colour, radius, height and text style all come from
        // `elevatedButtonTheme` — do not restate them here.
        button = ElevatedButton(onPressed: effectiveOnPressed, child: child);
        break;
      case ButtonVariant.danger:
        button = ElevatedButton(
          onPressed: effectiveOnPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.danger,
            foregroundColor: Colors.white,
            disabledBackgroundColor: AppColors.muted,
            disabledForegroundColor: Colors.white,
            elevation: 0,
            minimumSize: const Size(0, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: child,
        );
        break;
      case ButtonVariant.outline:
        button = OutlinedButton(onPressed: effectiveOnPressed, child: child);
        break;
    }

    // Width is expressed by the parent, never by a minimum size: an infinite
    // `minimumSize.width` throws wherever the incoming width is unbounded.
    return fullWidth
        ? SizedBox(width: double.infinity, child: button)
        : button;
  }

  Widget _buildContent() {
    if (isLoading) {
      // Gold and outlined buttons carry a black label, so a white spinner would
      // be invisible on them; only the red danger fill needs one.
      final spinnerColor =
          variant == ButtonVariant.danger ? Colors.white : AppColors.textPrimary;
      return SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2.2,
          valueColor: AlwaysStoppedAnimation<Color>(spinnerColor),
        ),
      );
    }

    if (icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20),
          const SizedBox(width: 8),
          Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
        ],
      );
    }

    return Text(label, overflow: TextOverflow.ellipsis);
  }
}
