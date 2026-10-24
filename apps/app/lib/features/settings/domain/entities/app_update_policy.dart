import 'package:equatable/equatable.dart';

/// What the installed build must do, decided by [AppUpdatePolicy.requirementFor].
enum AppUpdateRequirement {
  /// Up to date (or no versions configured).
  none,

  /// A newer release exists — the customer may update or carry on.
  optional,

  /// Below the minimum supported version — the app is blocked until updated.
  required,
}

/// One platform's slice of `general/config.appUpdate` (admin Settings › App
/// Update). Android and iOS carry separate policies because the two stores
/// release independently — an iOS build can lag Android by days of review.
///
/// A blank version means "not set" and never triggers a prompt, so a fresh
/// project (no `appUpdate` map yet) leaves every install alone.
class AppUpdatePolicy extends Equatable {
  const AppUpdatePolicy({
    required this.minVersion,
    required this.latestVersion,
    required this.storeUrl,
  });

  /// Installs below this are blocked until they update.
  final String minVersion;

  /// Installs below this are offered an update they can dismiss.
  final String latestVersion;

  /// Where "Update" sends the customer. Blank → the caller's fallback link.
  final String storeUrl;

  static const none = AppUpdatePolicy(minVersion: '', latestVersion: '', storeUrl: '');

  /// Compare the installed `x.y.z` version (a `+build` suffix is ignored)
  /// against this policy. Required wins over optional.
  AppUpdateRequirement requirementFor(String installedVersion) {
    if (installedVersion.trim().isEmpty) return AppUpdateRequirement.none;
    if (minVersion.trim().isNotEmpty &&
        compareVersions(installedVersion, minVersion) < 0) {
      return AppUpdateRequirement.required;
    }
    if (latestVersion.trim().isNotEmpty &&
        compareVersions(installedVersion, latestVersion) < 0) {
      return AppUpdateRequirement.optional;
    }
    return AppUpdateRequirement.none;
  }

  /// Semantic compare of `major.minor.patch`. Missing or non-numeric segments
  /// count as 0, so "1.2" == "1.2.0"; anything after `+` or `-` is ignored.
  static int compareVersions(String a, String b) {
    final pa = _parse(a);
    final pb = _parse(b);
    for (var i = 0; i < 3; i++) {
      if (pa[i] != pb[i]) return pa[i].compareTo(pb[i]);
    }
    return 0;
  }

  static List<int> _parse(String v) {
    final parts = v.trim().split('+').first.split('-').first.split('.');
    return List<int>.generate(
      3,
      (i) => i < parts.length ? (int.tryParse(parts[i].trim()) ?? 0) : 0,
    );
  }

  @override
  List<Object?> get props => [minVersion, latestVersion, storeUrl];
}
