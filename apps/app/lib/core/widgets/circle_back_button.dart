import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';

/// Where a back control sits, which is the only thing that changes about it.
enum CircleBackStyle {
  /// On the app background — a white disc with a hairline border. The default.
  surface,

  /// Over a photo (product gallery) — the same disc, slightly translucent so
  /// the image reads through it.
  onImage,

  /// On a dark/coloured background (the spin wheel) — a translucent white disc
  /// with a white glyph, since the hairline would be invisible there.
  onDark,
}

/// The single circular back control for the whole app.
///
/// WHY this exists: every screen used to hand-roll the same disc, and they had
/// drifted — 40px here, 42px there, some popping blindly and crashing out of a
/// deep link with nothing to pop. One widget keeps the geometry identical and
/// makes the safe pop (`canPop` → else route home) the default behaviour.
class CircleBackButton extends StatelessWidget {
  const CircleBackButton({
    super.key,
    this.onTap,
    this.fallbackRoute,
    this.style = CircleBackStyle.surface,
  });

  /// Diameter of the disc — the design's 42px touch target.
  static const double size = 42;

  /// `leadingWidth` an [AppBar] needs so [appBarLeading] lines the disc up with
  /// the screen's horizontal padding: 20 (padding) + 42 (disc) + 12 (gap).
  static const double leadingWidth =
      AppDimens.screenPadding + size + AppDimens.space12;

  /// Overrides the default pop. Pass this only when back means something other
  /// than "leave this page" (e.g. the search page closing its own overlay).
  final VoidCallback? onTap;

  /// Where to go when there is nothing to pop — a cold start on a deep link.
  /// Defaults to `/home`.
  final String? fallbackRoute;

  final CircleBackStyle style;

  /// The same control positioned as an [AppBar.leading]. Pair with
  /// `leadingWidth: CircleBackButton.leadingWidth`.
  static Widget appBarLeading({VoidCallback? onTap, String? fallbackRoute}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(left: AppDimens.screenPadding),
        child: CircleBackButton(onTap: onTap, fallbackRoute: fallbackRoute),
      ),
    );
  }

  void _back(BuildContext context) {
    if (context.canPop()) {
      context.pop();
      return;
    }
    context.go(fallbackRoute ?? '/home');
  }

  @override
  Widget build(BuildContext context) {
    final onDark = style == CircleBackStyle.onDark;

    return GestureDetector(
      onTap: onTap ?? () => _back(context),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: switch (style) {
            CircleBackStyle.surface => AppColors.surface,
            CircleBackStyle.onImage => AppColors.surface.withValues(alpha: 0.92),
            CircleBackStyle.onDark => Colors.white.withValues(alpha: 0.12),
          },
          shape: BoxShape.circle,
          border: onDark ? null : Border.all(color: AppColors.hairline),
        ),
        child: Icon(
          Icons.arrow_back_rounded,
          size: 20,
          color: onDark ? Colors.white : AppColors.textPrimary,
        ),
      ),
    );
  }
}
