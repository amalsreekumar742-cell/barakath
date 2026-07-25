import 'package:equatable/equatable.dart';

/// A saved delivery address (`users/{uid}/addresses/{id}`).
///
/// Also reused to render an order's embedded shipping address.
class Address extends Equatable {
  final String id;

  /// Home / Office / Other (spec §2.14) — what the saved-address card is titled
  /// by, so the customer picks by place rather than by re-reading the street.
  final String label;
  final String fullName;
  final String phone;
  final String addressLine1;
  final String addressLine2;
  final String city;
  final String state;
  final String pincode;
  final String landmark;
  final bool isDefault;
  final DateTime? createdAt;

  const Address({
    required this.id,
    required this.label,
    required this.fullName,
    required this.phone,
    required this.addressLine1,
    required this.addressLine2,
    required this.city,
    required this.state,
    required this.pincode,
    required this.landmark,
    required this.isDefault,
    required this.createdAt,
  });

  /// Single-line formatted address (empty parts dropped).
  String get formatted {
    final parts = [
      addressLine1,
      addressLine2,
      landmark,
      city,
      state,
      pincode,
    ].where((p) => p.trim().isNotEmpty);
    return parts.join(', ');
  }

  @override
  List<Object?> get props => [
        id,
        label,
        fullName,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        landmark,
        isDefault,
        createdAt,
      ];
}
