import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/utils/constants.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../providers/auth_provider.dart';

/// SplashPage — the launch gate (spec §2.1).
///
/// Shows the brand mark for ~2s, then: (1) reads `general/config` and force-updates
/// if the installed version is below `appMinVersion`; else (2) routes by first-launch
/// (onboarding) and auth/profile state.
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
      _fetchMinVersion(),
      _readCurrentVersion(),
      _waitForAuthResolved(),
    ]);

    if (!mounted) return;

    final minVersion = results[1] as String? ?? '';
    final currentVersion = results[2] as String? ?? '';

    if (minVersion.isNotEmpty &&
        currentVersion.isNotEmpty &&
        _isVersionLower(currentVersion, minVersion)) {
      await _showForceUpdateDialog();
      return; // Non-dismissible — user must update.
    }

    await _routeOnward();
  }

  Future<String?> _fetchMinVersion() async {
    try {
      final settings = context.read<GeneralSettingsProvider>();
      await settings.load();
      return settings.appMinVersion;
    } catch (_) {
      return null; // Never block launch on a config read failure.
    }
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

  Future<void> _showForceUpdateDialog() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _ForceUpdateDialog(),
    );
  }

  /// True when [current] is a lower semantic version than [minimum].
  /// Missing/short segments are treated as 0 (e.g. "1.2" == "1.2.0").
  bool _isVersionLower(String current, String minimum) {
    final a = _parseVersion(current);
    final b = _parseVersion(minimum);
    for (var i = 0; i < 3; i++) {
      if (a[i] != b[i]) return a[i] < b[i];
    }
    return false;
  }

  List<int> _parseVersion(String v) {
    final clean = v.split('+').first.split('-').first;
    final parts = clean.split('.');
    return List<int>.generate(
      3,
      (i) => i < parts.length ? (int.tryParse(parts[i].trim()) ?? 0) : 0,
    );
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

/// Non-dismissible force-update dialog. The only action is "Update" → store.
class _ForceUpdateDialog extends StatelessWidget {
  const _ForceUpdateDialog();

  Future<void> _openStore() async {
    final uri = Uri.parse(AppDetails.playStoreLink);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: const Text(
          'Update required',
          style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink),
        ),
        content: const Text(
          'A newer version of Barakath is available. Please update to continue.',
          style: TextStyle(color: AppColors.inkSoft, height: 1.4),
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _openStore,
              child: const Text('Update now'),
            ),
          ),
        ],
      ),
    );
  }
}
