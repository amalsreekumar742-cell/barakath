import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/general_settings.dart';

/// Data model for the `general/config` document — extends the [GeneralSettings]
/// entity and adds Firestore deserialization. Each admin tab writes its own
/// nested map (`delivery`, `payment`, `privacy`, `terms`, `contactus`); this
/// reads the slices the app needs.
class GeneralSettingsModel extends GeneralSettings {
  const GeneralSettingsModel({
    required super.standardDeliveryFee,
    required super.freeDeliveryThreshold,
    required super.gstPercentage,
    required super.gstin,
    required super.pricesIncludeTax,
    required super.razorpayKeyId,
    required super.razorpayConnected,
    required super.walletPaymentsEnabled,
    required super.privacyPolicy,
    required super.termsAndConditions,
    required super.privacyPolicyUpdatedAt,
    required super.termsUpdatedAt,
    required super.helpPhone,
    required super.helpWhatsApp,
    required super.helpEmail,
    required super.appMinVersion,
    required super.appLatestVersion,
    required super.updatedAt,
  });

  factory GeneralSettingsModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) =>
      GeneralSettingsModel.fromMap(doc.data() ?? const {});

  factory GeneralSettingsModel.fromMap(Map<String, dynamic> data) {
    final delivery = ModelParse.map(data['delivery']);
    final payment = ModelParse.map(data['payment']);
    final privacy = ModelParse.map(data['privacy']);
    final terms = ModelParse.map(data['terms']);
    final contact = ModelParse.map(data['contactus']);

    return GeneralSettingsModel(
      standardDeliveryFee: ModelParse.toDouble(delivery['standardDeliveryFee']),
      freeDeliveryThreshold: ModelParse.toDouble(delivery['freeDeliveryThreshold']),
      gstPercentage: ModelParse.toDouble(delivery['gstPercentage']),
      gstin: ModelParse.toStr(delivery['gstin']),
      pricesIncludeTax: ModelParse.toBool(delivery['pricesIncludeTax']),
      razorpayKeyId: ModelParse.toStr(payment['razorpayKeyId']),
      razorpayConnected: ModelParse.toBool(payment['razorpayConnected']),
      walletPaymentsEnabled: ModelParse.toBool(payment['walletPaymentsEnabled']),
      privacyPolicy: ModelParse.toStr(privacy['privacyPolicy']),
      termsAndConditions: ModelParse.toStr(terms['termsAndConditions']),
      privacyPolicyUpdatedAt: ModelParse.dateTime(privacy['privacyPolicyUpdatedAt']),
      termsUpdatedAt: ModelParse.dateTime(terms['termsUpdatedAt']),
      helpPhone: ModelParse.toStr(contact['helpPhone']),
      helpWhatsApp: ModelParse.toStr(contact['helpWhatsApp']),
      helpEmail: ModelParse.toStr(contact['helpEmail']),
      // Not present in the schema — defaulted. Read top-level `appMinVersion` /
      // `appLatestVersion` if the doc ever gains them, else fall back to 1.0.0.
      appMinVersion: ModelParse.toStr(data['appMinVersion'], '1.0.0'),
      appLatestVersion: ModelParse.toStr(data['appLatestVersion'], '1.0.0'),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
