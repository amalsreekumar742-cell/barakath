/// Font-family names for Barakath. Referenced via `AppFonts.*` and wired into
/// `ThemeData` (through `GoogleFonts`) in `core/theme/app_theme.dart` — never
/// inline a raw font-family string inside a widget.
class AppFonts {
  const AppFonts._();

  /// Primary UI typeface — the Figma design system uses Manrope (loaded at
  /// runtime via `google_fonts`).
  static const String manrope = 'Manrope';
}
