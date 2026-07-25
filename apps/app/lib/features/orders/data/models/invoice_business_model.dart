import 'package:cloud_firestore/cloud_firestore.dart' hide Order;

import '../../../../core/constants/app_details.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/invoice_business.dart';

/// Reads the seller block off `general/config`.
///
/// LAYOUT NOTE: the admin Settings screen writes its Delivery & Tax tab into a
/// nested `delivery` map, while the invoice Cloud Function reads the company
/// fields from the TOP level. Both layouts are honoured — grouped map first,
/// top level as the fallback — so a value set in either place is picked up.
class InvoiceBusinessModel extends InvoiceBusiness {
  const InvoiceBusinessModel({
    required super.name,
    required super.address,
    required super.gstin,
    required super.trn,
    required super.gstPercentage,
  });

  factory InvoiceBusinessModel.fromFirestore(
    DocumentSnapshot<Map<String, dynamic>> doc,
  ) =>
      InvoiceBusinessModel.fromMap(doc.data() ?? const {});

  factory InvoiceBusinessModel.fromMap(Map<String, dynamic> data) {
    final delivery = ModelParse.map(data['delivery']);
    return InvoiceBusinessModel(
      name: ModelParse.toStr(
        data['businessName'] ?? delivery['businessName'],
        AppDetails.appName,
      ),
      address: ModelParse.toStr(
        data['businessAddress'] ?? delivery['businessAddress'],
      ),
      gstin: ModelParse.toStr(delivery['gstin'] ?? data['gstin']),
      trn: ModelParse.toStr(data['businessTRN'] ?? delivery['businessTRN']),
      gstPercentage: ModelParse.toDouble(
        delivery['gstPercentage'] ?? data['gstPercentage'] ?? data['gstRate'],
      ),
    );
  }
}
