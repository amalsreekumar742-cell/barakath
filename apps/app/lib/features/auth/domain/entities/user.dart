import 'package:equatable/equatable.dart';

/// A customer account (`users/{uid}`) as a pure domain entity.
///
/// No Firebase/Flutter imports — the data layer's `UserModel` extends this and
/// owns all serialization. Money fields (walletBalance, affiliateBalance,
/// totalSpent) and counters (totalOrders) are server-owned and read-only here.
class User extends Equatable {
  const User({
    required this.id,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.profileImage,
    required this.status,
    required this.walletBalance,
    required this.affiliateCode,
    required this.affiliateBalance,
    required this.totalOrders,
    required this.totalSpent,
    required this.fcmToken,
    required this.referredByUserId,
    required this.createdAt,
    required this.updatedAt,
    this.whatsapp = '',
    this.pendingCommission = 0,
    this.confirmedCommission = 0,
    this.totalReferrals = 0,
    this.affiliateEnabled = false,
  });

  final String id;
  final String fullName;
  final String email;
  final String phone;
  final String profileImage;

  /// 'Active' | 'Blocked'.
  final String status;
  final double walletBalance;
  final String affiliateCode;
  final double affiliateBalance;
  final int totalOrders;
  final double totalSpent;
  final String fcmToken;
  final String referredByUserId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// WhatsApp number, which may differ from the login phone (spec §4.9).
  final String whatsapp;

  // --- Affiliate (spec §4.9). All server-owned; the client never writes them.

  /// Earned but still inside the 7-day clearing window.
  final double pendingCommission;

  /// Lifetime confirmed earnings.
  final double confirmedCommission;

  final int totalReferrals;

  /// Admin toggle for affiliate WALLET access. Affiliate access is OPT-IN, so
  /// this defaults to false: a missing field means an admin never granted it.
  /// Only the `setAffiliateEnabled` callable writes it.
  final bool affiliateEnabled;

  /// A signed-in user who has filled in at least their display name.
  bool get isProfileComplete => fullName.trim().isNotEmpty;

  /// Affiliate status. The code is only ever written by the admin's one-time
  /// allocation (and `generateReferralCode`), so a non-empty code IS the flag —
  /// the same test the admin panel and the affiliate Cloud Functions use.
  bool get isAffiliate => affiliateCode.trim().isNotEmpty;

  @override
  List<Object?> get props => [
        id,
        fullName,
        email,
        phone,
        profileImage,
        status,
        walletBalance,
        affiliateCode,
        affiliateBalance,
        totalOrders,
        totalSpent,
        fcmToken,
        referredByUserId,
        createdAt,
        updatedAt,
        whatsapp,
        pendingCommission,
        confirmedCommission,
        totalReferrals,
        affiliateEnabled,
      ];
}
