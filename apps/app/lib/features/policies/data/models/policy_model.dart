import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/policy.dart';

/// Data model for one `policies/{id}` document — extends the [Policy] entity
/// and adds Firestore deserialization. The doc id always wins over any `id`
/// field stored inside the document.
class PolicyModel extends Policy {
  const PolicyModel({
    required super.id,
    required super.name,
    required super.content,
    required super.order,
    required super.updatedAt,
  });

  factory PolicyModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) =>
      PolicyModel.fromMap(doc.id, doc.data() ?? const {});

  factory PolicyModel.fromMap(String id, Map<String, dynamic> data) {
    return PolicyModel(
      id: id,
      name: ModelParse.toStr(data['name']),
      content: ModelParse.toStr(data['content']),
      order: ModelParse.toInt(data['order']),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
