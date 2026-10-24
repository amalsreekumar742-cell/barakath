import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/utils/constants.dart';
import '../../../settings/domain/entities/app_update_policy.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../../../settings/presentation/widgets/app_update_dialog.dart';
import '../providers/auth_provider.dart';

/// SplashPage — the launch gate (spec §2.1).
///
/// Shows the brand mark for ~2s, then: (1) reads this platform's update policy
/// from `general/config.appUpdate` (admin Settings › App Update) — below the
/// minimum version the app is blocked behind "Update required"; below the
/// latest it offers "Update available" once per release; else (2) routes by
/// first-launch (onboarding) and auth/profile state.
class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fadeController;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    // Deferred to after the first frame: _bootstrap reaches
    // GeneralSettingsProvider.load(), which calls notifyListeners() before its
    // first await. Called straight from initState that lands mid-build and
    // trips "setState() or markNeedsBuild() called during build" — caught by the
    // framework, but a real assertion error on every cold start.
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    // Hold on the splash for the brand moment while auth resolves in parallel.
    final results = await Future.wait<Object?>([
      Future.delayed(const Duration(seconds: 2)),
      _fetchUpdatePolicy(),
      _readCurrentVersion(),
      _waitForAuthResolved(),
    ]);

    if (!mounted) return;

    final policy = results[1] as AppUpdatePolicy? ?? AppUpdatePolicy.none;
    final currentVersion = results[2] as String? ?? '';

    switch (policy.requirementFor(currentVersion)) {
      case AppUpdateRequirement.required:
        await AppUpdateDialog.show(
          context,
          isRequired: true,
          storeUrl: _storeUrl(policy),
        );
        return; // Non-dismissible — user must update.
      case AppUpdateRequirement.optional:
        await _offerOptionalUpdate(policy);
      case AppUpdateRequirement.none:
        break;
    }

    await _routeOnward();
  }

  Future<AppUpdatePolicy?> _fetchUpdatePolicy() async {
    try {
      final settings = context.read<GeneralSettingsProvider>();
      await settings.load();
      return settings.updatePolicy;
    } catch (_) {
      return null; // Never block launch on a config read failure.
    }
  }

  /// "Update available" — once per release: the shown `latestVersion` is
  /// remembered whether the customer taps Update or Later, so a customer who
  /// stays on the old build is not nagged on every launch.
  Future<void> _offerOptionalUpdate(AppUpdatePolicy policy) async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getString(PrefKeys.seenUpdateVersion) == policy.latestVersion) {
      return;
    }
    if (!mounted) return;
    await AppUpdateDialog.show(
      context,
      isRequired: false,
      storeUrl: _storeUrl(policy),
    );
    await prefs.setString(PrefKeys.seenUpdateVersion, policy.latestVersion);
  }

  /// The admin-set store link, else this platform's built-in one.
  String _storeUrl(AppUpdatePolicy policy) {
    if (policy.storeUrl.isNotEmpty) return policy.storeUrl;
    return defaultTargetPlatform == TargetPlatform.iOS
        ? AppDetails.appStoreLink
        : AppDetails.playStoreLink;
  }

  Future<String?> _readCurrentVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      return info.version;
    } catch (_) {
      return null;
    }
  }

  /// Waits until AuthProvider has resolved its initial auth state.
  Future<void> _waitForAuthResolved() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoading) return;
    final completer = Completer<void>();
    void listener() {
      if (!auth.isLoading && !completer.isCompleted) {
        auth.removeListener(listener);
        completer.complete();
      }
    }

    auth.addListener(listener);
    // Safety timeout so a stuck stream never freezes the splash.
    return completer.future.timeout(
      const Duration(seconds: 5),
      onTimeout: () => auth.removeListener(listener),
    );
  }

  Future<void> _routeOnward() async {
    final prefs = await SharedPreferences.getInstance();
    final onboardingComplete =
        prefs.getBool(PrefKeys.onboardingComplete) ?? false;

    if (!mounted) return;

    if (!onboardingComplete) {
      context.go('/onboarding');
      return;
    }

    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      context.go('/login');
    } else if (auth.isProfileComplete) {
      context.go('/home');
    } else {
      context.go('/create-profile');
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Splash background: subtle warm gradient (white → desert cream) per Figma.
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.white, AppColors.cream],
          ),
        ),
        child: Center(
          child: FadeTransition(
            opacity: CurvedAnimation(
              parent: _fadeController,
              curve: Curves.easeIn,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Gold flame + BARAKATH wordmark (shadow baked into the asset).
                Image.asset(
                  'assets/images/logo_barakath.png',
                  width: 104,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 20),
                Text(
                  'Perfumes · Books · Clothing · Islamic',
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    fontWeight: FontWeight.w400,
                    letterSpacing: 0.3,
                    color: Colors.black.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
