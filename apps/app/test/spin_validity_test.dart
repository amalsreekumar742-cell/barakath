import 'package:flutter_test/flutter_test.dart';

import 'package:barakath/features/spinner/domain/entities/spin_result.dart';
import 'package:barakath/features/spinner/domain/entities/spinner_campaign.dart';

/// Parity tests for the spin-reward validity rule.
///
/// The same three-line resolution exists in `packages/shared/src/utils/spinValidity.ts`
/// (admin + website) and inside the `spinWheel` callable, which is what actually stamps the
/// expiry. If this file and those disagree, the app shows the customer a deadline the server
/// will not honour — which is exactly the bug the hours field was added to avoid. These cases
/// mirror the ones the shared helper was verified against.
SpinnerCampaign campaign({int hours = 0, int days = 0}) => SpinnerCampaign(
      id: 'c1',
      name: 'Test',
      description: '',
      slots: const [],
      maxSpinsPerUser: 1,
      spinCooldownHours: 0,
      couponValidityDays: days,
      couponValidityHours: hours,
      isActive: true,
      totalSpins: 0,
      totalWins: 0,
      startDate: null,
      endDate: null,
      createdAt: null,
      updatedAt: null,
    );

void main() {
  group('SpinnerCampaign.validityHours', () {
    test('hours wins over days when set', () {
      expect(campaign(hours: 1, days: 3).validityHours, 1);
      expect(campaign(hours: 6, days: 3).validityHours, 6);
    });

    test('falls back to days when hours is absent (legacy campaigns)', () {
      expect(campaign(days: 3).validityHours, 72);
      expect(campaign(days: 1).validityHours, 24);
    });

    test('falls back to the 3-day spec default when neither is set', () {
      expect(campaign().validityHours, 72);
    });
  });

  group('SpinnerCampaign.validityLabel', () {
    test('sub-day windows read in hours', () {
      expect(campaign(hours: 1).validityLabel, '1 hour');
      expect(campaign(hours: 6).validityLabel, '6 hours');
    });

    test('whole days read in days', () {
      expect(campaign(days: 3).validityLabel, '3 days');
      expect(campaign(days: 1).validityLabel, '1 day');
    });

    test('mixed windows read as both', () {
      expect(campaign(hours: 30).validityLabel, '1 day 6 hours');
    });
  });

  group('SpinRewardCoupon.expiresInLabel', () {
    final now = DateTime.utc(2026, 8, 3, 12);

    SpinRewardCoupon at(Duration left) => SpinRewardCoupon(
          code: 'SPIN-ABC123',
          discountType: 'Percentage',
          discountValue: 10,
          minimumOrderAmount: 0,
          maximumDiscount: 100,
          validUntil: now.add(left),
        );

    test('picks the unit from the time actually remaining', () {
      expect(at(const Duration(minutes: 45)).expiresInLabel(now), 'expires in 45 minutes');
      expect(at(const Duration(hours: 1)).expiresInLabel(now), 'expires in 1 hour');
      expect(at(const Duration(hours: 3)).expiresInLabel(now), 'expires in 3 hours');
      expect(at(const Duration(hours: 26)).expiresInLabel(now), 'expires in 1 day');
      expect(at(const Duration(hours: 72)).expiresInLabel(now), 'expires in 3 days');
    });

    test('is null once lapsed or unknown, so the caller omits the line', () {
      expect(at(const Duration(seconds: -1)).expiresInLabel(now), isNull);
      expect(
        const SpinRewardCoupon(
          code: 'SPIN-ABC123',
          discountType: 'Percentage',
          discountValue: 10,
          minimumOrderAmount: 0,
          maximumDiscount: 100,
          validUntil: null,
        ).expiresInLabel(now),
        isNull,
      );
    });
  });
}
