import 'package:flutter/material.dart';

/// Geometry tokens from the customer-app prototypes (`docs/design/app/*.dc.html`,
/// design system `ecom-barakath-4730b472`). See `docs/design/app/BATCH4_DESIGN_MAP.md`.
///
/// WHY these are constants and not inline numbers: six feature sessions build
/// against this palette in parallel. A raw `12` in one screen and `14` in another
/// is invisible in review but obvious on a phone.
class AppDimens {
  const AppDimens._();

  // --- Radius (design tokens radius/xs…pill) --------------------------------
  static const double radiusXs = 4;
  static const double radiusSm = 6;

  /// Buttons and text inputs.
  static const double radiusMd = 8;

  /// Content cards — the default for anything panel-shaped.
  static const double radiusCard = 12;
  static const double radiusXl = 16;

  /// Chips, badges, steppers, avatars.
  static const double radiusPill = 9999;

  // --- Spacing (4-based scale) ----------------------------------------------
  static const double space4 = 4;
  static const double space6 = 6;
  static const double space8 = 8;
  static const double space10 = 10;
  static const double space12 = 12;
  static const double space14 = 14;
  static const double space16 = 16;
  static const double space20 = 20;
  static const double space24 = 24;

  /// Horizontal padding of every full screen.
  static const double screenPadding = 20;

  /// Inner padding of a content card.
  static const double cardPadding = 14;

  /// Vertical gap between two stacked cards.
  static const double gapCards = 12;

  /// Vertical gap between two sections.
  static const double gapSections = 20;

  // --- Components -----------------------------------------------------------
  /// Primary/secondary button height (design: 46–52; the theme uses this).
  static const double buttonHeight = 52;

  /// Square thumbnail in a list tile (order item, bag line, wishlist row).
  static const double tileThumb = 72;

  /// Page size for every cursor-paginated list (skill: mandatory pagination).
  static const int pageSize = 12;

  // --- Elevation ------------------------------------------------------------
  // Content cards are FLAT with a 1px hairline border. Shadow is reserved for
  // the bottom nav and sheets — do not put `shadowMd` on a list card.
  static const List<BoxShadow> shadowXs = [
    BoxShadow(color: Color(0x0F5F4A2E), blurRadius: 2, offset: Offset(0, 1)),
  ];
  static const List<BoxShadow> shadowSm = [
    BoxShadow(color: Color(0x0A1B1C1D), blurRadius: 4, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x0A5F4A2E), blurRadius: 2, offset: Offset(0, 1)),
  ];
  static const List<BoxShadow> shadowMd = [
    BoxShadow(color: Color(0x145F4A2E), blurRadius: 16, offset: Offset(0, 6)),
    BoxShadow(color: Color(0x0A5F4A2E), blurRadius: 2, offset: Offset(0, 1)),
  ];

  /// Bottom navigation bar — the one place with an upward shadow.
  static const List<BoxShadow> shadowNav = [
    BoxShadow(color: Color(0x0D5F4A2E), blurRadius: 8, offset: Offset(0, -6)),
  ];
}
