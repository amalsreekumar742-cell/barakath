import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/user.dart';

/// Data-layer [User] with Firestore (de)serialization.
///
/// Money fields (walletBalance, affiliateBalance, totalSpent) and totalOrders are
/// maintained server-side by Cloud Functions and are never written from the app —
/// [toFirestore] only emits the profile fields the customer is allowed to edit.
class UserModel extends User {
  const UserModel({
    required super.id,
    required super.fullName,
    required super.email,
    required super.phone,
    required super.profileImage,
    required super.status,
    required super.walletBalance,
    required super.affiliateCode,
    required super.affiliateBalance,
    required super.totalOrders,
    required super.totalSpent,
    required super.fcmToken,
    required super.referredByUserId,
    required super.createdAt,
    required super.updatedAt,
    super.whatsapp,
    super.pendingCommission,
    super.confirmedCommission,
    super.totalReferrals,
    super.affiliateEnabled,
  });

  factory UserModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? const {};
    return UserModel(
      id: doc.id,
      fullName: ModelParse.toStr(data['fullName']),
      email: ModelParse.toStr(data['email']),
      phone: ModelParse.toStr(data['phone']),
      profileImage: ModelParse.toStr(data['profileImage']),
      status: ModelParse.toStr(data['status'], 'Active'),
      walletBalance: ModelParse.toDouble(data['walletBalance']),
      affiliateCode: ModelParse.toStr(data['affiliateCode']),
      affiliateBalance: ModelParse.toDouble(data['affiliateBalance']),
      totalOrders: ModelParse.toInt(data['totalOrders']),
      totalSpent: ModelParse.toDouble(data['totalSpent']),
      fcmToken: ModelParse.toStr(data['fcmToken']),
      referredByUserId: ModelParse.toStr(data['referredByUserId']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
      whatsapp: ModelParse.toStr(data['whatsapp']),
      pendingCommission: ModelParse.toDouble(data['pendingCommission']),
      confirmedCommission: ModelParse.toDouble(data['confirmedCommission']),
      totalReferrals: ModelParse.toInt(data['totalReferrals']),
      // Opt-in: absent means "never granted" — see the entity's note.
      affiliateEnabled: ModelParse.toBool(data['affiliateEnabled'], false),
    );
  }

  /// A signed-in user whose `users/{uid}` document does not exist yet (or failed
  /// to read). Carries only the uid so the app knows they are authenticated but
  /// still have an incomplete profile (empty name → route to profile creation).
  factory UserModel.empty(String id) => UserModel(
        id: id,
        fullName: '',
        email: '',
        phone: '',
        profileImage: '',
        status: 'Active',
        walletBalance: 0,
        affiliateCode: '',
        affiliateBalance: 0,
        totalOrders: 0,
        totalSpent: 0,
        fcmToken: '',
        referredByUserId: '',
        createdAt: null,
        updatedAt: null,
      );

  /// Profile fields the customer app is allowed to write. Server-owned money and
  /// counters are intentionally excluded. `updatedAt` uses a server timestamp.
  Map<String, dynamic> toFirestore() {
    return {
      'fullName': fullName,
      'email': email,
      'phone': phone,
      'profileImage': profileImage,
      'fcmToken': fcmToken,
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  UserModel copyWith({
    String? fullName,
    String? email,
    String? phone,
    String? profileImage,
    String? fcmToken,
  }) {
    return UserModel(
      id: id,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      profileImage: profileImage ?? this.profileImage,
      status: status,
      walletBalance: walletBalance,
      affiliateCode: affiliateCode,
      affiliateBalance: affiliateBalance,
      totalOrders: totalOrders,
      totalSpent: totalSpent,
      fcmToken: fcmToken ?? this.fcmToken,
      referredByUserId: referredByUserId,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
