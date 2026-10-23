import 'package:flutter_test/flutter_test.dart';

import 'package:barakath/features/settings/domain/entities/app_update_policy.dart';

void main() {
  const policy = AppUpdatePolicy(
    minVersion: '1.2.0',
    latestVersion: '1.4.0',
    storeUrl: '',
  );

  group('AppUpdatePolicy.requirementFor', () {
    test('below the minimum is a required update', () {
      expect(policy.requirementFor('1.1.9'), AppUpdateRequirement.required);
    });

    test('at the minimum but below the latest is optional', () {
      expect(policy.requirementFor('1.2.0'), AppUpdateRequirement.optional);
      expect(policy.requirementFor('1.3.7'), AppUpdateRequirement.optional);
    });

    test('at or above the latest needs nothing', () {
      expect(policy.requirementFor('1.4.0'), AppUpdateRequirement.none);
      expect(policy.requirementFor('2.0.0'), AppUpdateRequirement.none);
    });

    test('a blank policy (admin never saved) never prompts', () {
      expect(AppUpdatePolicy.none.requirementFor('0.0.1'), AppUpdateRequirement.none);
    });

    test('an unreadable installed version never blocks', () {
      expect(policy.requirementFor(''), AppUpdateRequirement.none);
    });

    test('only a latest version set gives an optional prompt, never a block', () {
      const latestOnly = AppUpdatePolicy(minVersion: '', latestVersion: '1.1.0', storeUrl: '');
      expect(latestOnly.requirementFor('1.0.0'), AppUpdateRequirement.optional);
    });
  });

  group('AppUpdatePolicy.compareVersions', () {
    test('compares numerically, not as text', () {
      expect(AppUpdatePolicy.compareVersions('1.10.0', '1.9.0'), greaterThan(0));
    });

    test('missing segments count as zero and build suffixes are ignored', () {
      expect(AppUpdatePolicy.compareVersions('1.2', '1.2.0'), 0);
      expect(AppUpdatePolicy.compareVersions('1.2.0+7', '1.2.0'), 0);
    });
  });
}
