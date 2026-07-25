import 'package:equatable/equatable.dart';

import '../../../../core/constants/app_details.dart';

/// The seller block of the tax invoice (spec Part 7 "Business Info").
///
/// WHY this lives in the orders feature and not in `GeneralSettings`: the
/// deployed `generateInvoicePDF` Cloud Function reads `businessName`,
/// `businessAddress` and `businessTRN` from the TOP LEVEL of `general/config`,
/// but the app's `GeneralSettings` entity models only the `delivery` map (which
/// is where `gstin` and `gstPercentage` live). Rather than reach into another
/// session's feature, the invoice reads the three seller fields it needs itself.
/// Long term these belong on `GeneralSettings` — reported to the coordinator.
class InvoiceBusiness extends Equatable {
  const InvoiceBusiness({
    required this.name,
    required this.address,
    required this.gstin,
    required this.trn,
    required this.gstPercentage,
  });

  final String name;
  final String address;
  final String gstin;

  /// Tax Registration Number — a UAE field the spec's template carries. Blank
  /// on an India-only configuration, in which case the row is not rendered.
  final String trn;

  final double gstPercentage;

  /// Safe defaults so the invoice still renders if `general/config` is missing
  /// the seller block; the store's own name is never blank.
  static const empty = InvoiceBusiness(
    name: AppDetails.appName,
    address: '',
    gstin: '',
    trn: '',
    gstPercentage: 0,
  );

  @override
  List<Object?> get props => [name, address, gstin, trn, gstPercentage];
}
