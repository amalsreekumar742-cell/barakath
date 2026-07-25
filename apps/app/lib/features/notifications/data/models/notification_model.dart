import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/app_notification.dart';

/// A push/broadcast notification document (`notifications/{id}`), read-only in
/// the app.
class NotificationModel extends AppNotification {
  const NotificationModel({
    required super.id,
    required super.title,
    required super.body,
    required super.image,
    required super.type,
    required super.targetType,
    required super.targetUserIds,
    required super.linkType,
    required super.linkValue,
    required super.isScheduled,
    required super.scheduledAt,
    required super.isSent,
    required super.sentAt,
    required super.sentBy,
    required super.sentByName,
    required super.recipientCount,
    required super.createdAt,
    required super.updatedAt,
  });

  factory NotificationModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) {
    final data = doc.data() ?? const {};
    return NotificationModel(
      id: doc.id,
      title: ModelParse.toStr(data['title']),
      body: ModelParse.toStr(data['body']),
      image: ModelParse.toStr(data['image']),
      type: ModelParse.toStr(data['type'], 'Broadcast'),
      targetType: ModelParse.toStr(data['targetType'], 'All'),
      targetUserIds: ModelParse.stringList(data['targetUserIds']),
      linkType: ModelParse.toStr(data['linkType'], 'None'),
      linkValue: ModelParse.toStr(data['linkValue']),
      isScheduled: ModelParse.toBool(data['isScheduled']),
      scheduledAt: ModelParse.dateTime(data['scheduledAt']),
      isSent: ModelParse.toBool(data['isSent']),
      sentAt: ModelParse.dateTime(data['sentAt']),
      sentBy: ModelParse.toStr(data['sentBy']),
      sentByName: ModelParse.toStr(data['sentByName']),
      recipientCount: ModelParse.toInt(data['recipientCount']),
      createdAt: ModelParse.dateTime(data['createdAt']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
