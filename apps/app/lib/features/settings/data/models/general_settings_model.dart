import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/app_update_policy.dart';
import '../../domain/entities/general_settings.dart';

/// Data model for the `general/config` document — extends the [GeneralSettings]
/// entity and adds Firestore deserialization. Each admin tab writes its own
/// nested map (`delivery`, `payment`, `contactus`, …); this reads the slices
/// the app needs. The legacy `privacy`/`terms` maps are deliberately ignored —
/// policies are read from the `policies` collection now.
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
    required super.helpPhone,
    required super.helpWhatsApp,
    required super.helpEmail,
    required super.androidUpdate,
    required super.iosUpdate,
    required super.updatedAt,
  });

  factory GeneralSettingsModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) =>
      GeneralSettingsModel.fromMap(doc.data() ?? const {});

  factory GeneralSettingsModel.fromMap(Map<String, dynamic> data) {
    final delivery = ModelParse.map(data['delivery']);
    final payment = ModelParse.map(data['payment']);
    final contact = ModelParse.map(data['contactus']);
    // Admin Settings › App Update. Absent until first saved → no prompts.
    final appUpdate = ModelParse.map(data['appUpdate']);

    return GeneralSettingsModel(
      standardDeliveryFee: ModelParse.toDouble(delivery['standardDeliveryFee']),
      freeDeliveryThreshold: ModelParse.toDouble(delivery['freeDeliveryThreshold']),
      gstPercentage: ModelParse.toDouble(delivery['gstPercentage']),
      gstin: ModelParse.toStr(delivery['gstin']),
      pricesIncludeTax: ModelParse.toBool(delivery['pricesIncludeTax']),
      razorpayKeyId: ModelParse.toStr(payment['razorpayKeyId']),
      razorpayConnected: ModelParse.toBool(payment['razorpayConnected']),
      walletPaymentsEnabled: ModelParse.toBool(payment['walletPaymentsEnabled']),
      helpPhone: ModelParse.toStr(contact['helpPhone']),
      helpWhatsApp: ModelParse.toStr(contact['helpWhatsApp']),
      helpEmail: ModelParse.toStr(contact['helpEmail']),
      androidUpdate: AppUpdatePolicy(
        minVersion: ModelParse.toStr(appUpdate['androidMinVersion']).trim(),
        latestVersion: ModelParse.toStr(appUpdate['androidLatestVersion']).trim(),
        storeUrl: ModelParse.toStr(appUpdate['androidStoreUrl']).trim(),
      ),
      iosUpdate: AppUpdatePolicy(
        minVersion: ModelParse.toStr(appUpdate['iosMinVersion']).trim(),
        latestVersion: ModelParse.toStr(appUpdate['iosLatestVersion']).trim(),
        storeUrl: ModelParse.toStr(appUpdate['iosStoreUrl']).trim(),
      ),
      updatedAt: ModelParse.dateTime(data['updatedAt']),
    );
  }
}
