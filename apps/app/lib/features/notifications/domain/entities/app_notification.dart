import 'package:equatable/equatable.dart';

/// A push/broadcast notification document (`notifications/{id}`), read-only in
/// the app.
class AppNotification extends Equatable {
  final String id;
  final String title;
  final String body;
  final String image;

  /// 'Broadcast' | 'Order' | 'Promotion' | 'Wallet' | 'Affiliate' |
  /// 'Replacement' | 'System'.
  final String type;

  /// 'All' | 'Specific'.
  final String targetType;
  final List<String> targetUserIds;

  /// 'Product' | 'Category' | 'Order' | 'None'.
  final String linkType;
  final String linkValue;
  final bool isScheduled;
  final DateTime? scheduledAt;
  final bool isSent;
  final DateTime? sentAt;
  final String sentBy;
  final String sentByName;
  final int recipientCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.image,
    required this.type,
    required this.targetType,
    required this.targetUserIds,
    required this.linkType,
    required this.linkValue,
    required this.isScheduled,
    required this.scheduledAt,
    required this.isSent,
    required this.sentAt,
    required this.sentBy,
    required this.sentByName,
    required this.recipientCount,
    required this.createdAt,
    required this.updatedAt,
  });

  @override
  List<Object?> get props => [
        id,
        title,
        body,
        image,
        type,
        targetType,
        targetUserIds,
        linkType,
        linkValue,
        isScheduled,
        scheduledAt,
        isSent,
        sentAt,
        sentBy,
        sentByName,
        recipientCount,
        createdAt,
        updatedAt,
      ];
}
