import 'package:flutter/material.dart';

/// Design tokens for Barakath — warm, premium light palette from the app design
/// prototype (dark ink on cream, gold accent, herbal green for success).
///
/// These are wired into `ThemeData` in `core/theme/app_theme.dart`; widgets read
/// `Theme.of(context)` or `AppColors.*` and never inline `Color(0xFF...)`.
class AppColors {
  const AppColors._();

  static const Color ink = Color(0xFF17130E); // primary — near-black warm ink
  static const Color inkSoft = Color(0xFF4A3A22); // secondary text / brown
  static const Color gold = Color(0xFFB8863B); // accent / gold
  static const Color goldSoft = Color(0xFFE0CBB6);
  static const Color cream = Color(0xFFF6F1E8); // splash gradient warm stop
  static const Color surface = Color(0xFFFFFFFF); // cards / inputs
  static const Color subtle = Color(0xFFEFEAE4); // chips / fills
  static const Color border = Color(0xFFE6DED2);
  static const Color muted = Color(0xFF8A7E6E); // hint / tertiary text
  static const Color success = Color(0xFF0F7A5A);
  static const Color danger = Color(0xFFDC2626);

  // --- Figma design-system tokens (BARAKAT_ECOM) -----------------------------
  // These are the authoritative auth/onboarding palette pulled from the design.
  static const Color background = Color(0xFFFCFCFB); // surface/background
  static const Color cta = Color(0xFFDAA227); // brand/gold — mustard CTA button
  static const Color brandGreen = Color(0xFF0F7A5A); // text/brand
  static const Color brandGreenSubtle = Color(0xFFE9F4EF); // brand/primary-subtle (tiles)
  static const Color brandGreenDark = Color(0xFF166534); // brand/primary-dark (avatar)
  static const Color hairline = Color(0xFFECECEC); // border/default
  static const Color textPrimary = Color(0xFF000000); // headings
  static const Color textSecondary = Color(0xFF7F7F7F); // body / labels
  static const Color textFaint = Color(0xFF9EA2AD); // "(optional)" / fine print

  /// brand/gold-strong — the price colour on product cards and the ACTIVE
  /// bottom-nav tab. Distinct from [cta] (#DAA227), which fills buttons.
  static const Color goldStrong = Color(0xFFB8881F);

  /// colours/text-status-error + its 10% tint (flash-sale countdown chip).
  /// Also the debit amount colour in wallet history.
  static const Color statusError = Color(0xFFFB3748);
  static const Color statusErrorSubtle = Color(0x1AFB3748);

  // --- Batch 4 tokens (docs/design/app/BATCH4_DESIGN_MAP.md) ----------------

  /// brand/gold-subtle — the tinted card behind a spin reward or applied coupon.
  static const Color goldSubtle = Color(0xFFFBF4DD);

  /// border/gold — the 1px edge of a [goldSubtle] card.
  static const Color goldBorder = Color(0xFFE8D28A);

  /// Text on a gold-subtle badge. Darker than [goldStrong] so 11px copy still
  /// passes contrast on the pale fill.
  static const Color goldBadgeText = Color(0xFF8A6410);

  /// semantic/success — "Free", wallet credits, delivered/confirmed badges.
  /// Distinct from [brandGreen], which is the brand colour for links and ticks.
  static const Color semanticSuccess = Color(0xFF16A34A);
  static const Color semanticSuccessStrong = Color(0xFF1FC16B);
  static const Color semanticSuccessSubtle = Color(0x1A16A34A);

  /// semantic/info — "Shipped" / "Out for delivery": moving, not finished.
  /// Figma `My orders` node 46:7057 (#DFEFFF chip, #005AA5 label).
  static const Color info = Color(0xFF005AA5);
  static const Color infoSubtle = Color(0xFFDFEFFF);

  static const Color warning = Color(0xFFFFDB43);
  static const Color warningSubtle = Color(0x33FFDB43);

  /// neutral/50 — subtle surface behind read-only blocks (specs, timelines).
  static const Color surfaceSubtle = Color(0xFFF8F8F8);

  /// neutral/300 — the stronger border, for selected/emphasised outlines.
  static const Color borderStrong = Color(0xFFE5E5E5);

  // --- Home / Spin & Win banner (design prototype, frame "08 · Home") -------
  /// Gradient start (dark bronze) for the Spin & Win promo banner.
  static const Color goldBronze = Color(0xFF8A6314);

  /// Gradient end (light highlight) for the Spin & Win promo banner.
  static const Color goldHighlight = Color(0xFFF0C552);
}
