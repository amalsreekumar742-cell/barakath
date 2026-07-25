import 'package:cloud_firestore/cloud_firestore.dart';

import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/address.dart';

/// A saved delivery address (`users/{uid}/addresses/{id}`).
///
/// Also reused to render an order's embedded shipping address — see
/// [AddressModel.fromMap], which tolerates the order shipping map that lacks
/// `id` / `isDefault` / `createdAt`.
class AddressModel extends Address {
  const AddressModel({
    required super.id,
    required super.label,
    required super.fullName,
    required super.phone,
    required super.addressLine1,
    required super.addressLine2,
    required super.city,
    required super.state,
    required super.pincode,
    required super.landmark,
    required super.isDefault,
    required super.createdAt,
  });

  factory AddressModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    return AddressModel.fromMap(doc.data() ?? const {}, doc.id);
  }

  /// Wrap a domain [Address] so it can be serialised. The form and the providers
  /// work in entities; only this layer knows the Firestore shape.
  factory AddressModel.fromEntity(Address a) => AddressModel(
        id: a.id,
        label: a.label,
        fullName: a.fullName,
        phone: a.phone,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2,
        city: a.city,
        state: a.state,
        pincode: a.pincode,
        landmark: a.landmark,
        isDefault: a.isDefault,
        createdAt: a.createdAt,
      );

  /// The same address carrying the id Firestore just generated.
  AddressModel copyWithId(String newId) => AddressModel(
        id: newId,
        label: label,
        fullName: fullName,
        phone: phone,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        city: city,
        state: state,
        pincode: pincode,
        landmark: landmark,
        isDefault: isDefault,
        createdAt: createdAt,
      );

  factory AddressModel.fromMap(Map<String, dynamic> data, [String id = '']) {
    return AddressModel(
      id: id.isNotEmpty ? id : ModelParse.toStr(data['id']),
      // Addresses saved before the label existed fall back to Home rather than
      // rendering a blank card title.
      label: ModelParse.toStr(data['label']).isEmpty
          ? 'Home'
          : ModelParse.toStr(data['label']),
      fullName: ModelParse.toStr(data['fullName']),
      phone: ModelParse.toStr(data['phone']),
      addressLine1: ModelParse.toStr(data['addressLine1']),
      addressLine2: ModelParse.toStr(data['addressLine2']),
      city: ModelParse.toStr(data['city']),
      state: ModelParse.toStr(data['state']),
      pincode: ModelParse.toStr(data['pincode']),
      landmark: ModelParse.toStr(data['landmark']),
      isDefault: ModelParse.toBool(data['isDefault']),
      createdAt: ModelParse.dateTime(data['createdAt']),
    );
  }

  /// Fields the app writes for an address. `createdAt` uses a server timestamp
  /// when [withCreatedAt] is set (new address); omit it on edits.
  Map<String, dynamic> toFirestore({bool withCreatedAt = false}) {
    return {
      'label': label,
      'fullName': fullName,
      'phone': phone,
      'addressLine1': addressLine1,
      'addressLine2': addressLine2,
      'city': city,
      'state': state,
      'pincode': pincode,
      'landmark': landmark,
      'isDefault': isDefault,
      if (withCreatedAt) 'createdAt': FieldValue.serverTimestamp(),
    };
  }

  /// The flat shipping-address shape embedded on an order document.
  Map<String, dynamic> toShippingMap() {
    return {
      'label': label,
      'fullName': fullName,
      'phone': phone,
      'addressLine1': addressLine1,
      'addressLine2': addressLine2,
      'city': city,
      'state': state,
      'pincode': pincode,
      'landmark': landmark,
    };
  }
}
