/// Single source of truth for app identity, config defaults/thresholds, FCM
/// topics, and external links — grouped by category so it stays scannable.
///
/// Never inline app-identity values, numeric defaults, topic names, or store/
/// share links inside `features/`; add/reuse an entry here and reference it.
/// Real secrets/API keys do NOT belong here as literals — inject them via
/// `--dart-define`/env config (see the skill's "Secrets & API Keys" rule).
class AppDetails {
  const AppDetails._();

  // --------------------- APP IDENTITY --------------------- //
  static const String appName = 'Barakath';
  static const String packageName = 'com.barakath.barakath';
  static const String projectId = 'barakath-e6ad3';
  static const String tagline = 'Four worlds, one store';

  // --------------------- FCM TOPICS --------------------- //
  static const String userSubscribeTopic = 'users';
  static const String allSubscribeTopic = 'all';

  // --------------------- DEFAULTS / THRESHOLDS --------------------- //
  /// Default phone country code (India).
  static const String initialCountryCodeSelection = '+91';

  /// Currency (Indian Rupee).
  static const String currencySymbol = '₹';
  static const String currencyCode = 'INR';

  /// OTP login (spec §2.3).
  static const int otpLength = 6;
  static const int otpResendSeconds = 30;

  /// Affiliate (spec §2.22): minimum withdrawal + commission clearing period.
  static const double minWithdrawalAmount = 10000;
  static const int affiliateClearingDays = 7;

  // --------------------- STORE / SHARE LINKS --------------------- //
  // NOTE: package id not yet finalised on the stores — update once published.
  static const String playStoreLink =
      'https://play.google.com/store/apps/details?id=$packageName';
  static const String appStoreLink = 'https://apps.apple.com/app/barakath';
}
