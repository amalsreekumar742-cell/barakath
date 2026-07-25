import 'dart:io';

import 'package:equatable/equatable.dart';

/// Everything the customer supplies when raising a replacement request
/// (spec §2.18), before it becomes a `replacements/{id}` document.
///
/// WHY the product/variant strings are carried rather than looked up server-side:
/// the request is a snapshot of what was actually delivered. If the catalogue
/// renames the variant next week, the admin resolving the request must still see
/// what the customer received.
///
/// [photos] are on-device files; the data layer uploads them and swaps in the
/// download URLs. (`dart:io` is Dart core, not Flutter — the domain still has no
/// widget/Firebase dependency.)
class ReplacementDraft extends Equatable {
  const ReplacementDraft({
    required this.orderId,
    required this.userName,
    required this.userPhone,
    required this.userEmail,
    required this.productId,
    required this.productName,
    required this.productImage,
    required this.variantId,
    required this.variantName,
    required this.variantColor,
    required this.quantity,
    required this.reason,
    required this.description,
    required this.photos,
  });

  final String orderId;
  final String userName;
  final String userPhone;
  final String userEmail;
  final String productId;
  final String productName;
  final String productImage;
  final String variantId;
  final String variantName;
  final String variantColor;
  final int quantity;

  /// One of the FOUR spec §2.18 options (`ReplacementReason.label`).
  final String reason;

  /// "Describe the issue" — required, min 10 characters.
  final String description;

  final List<File> photos;

  /// What lands in the document's `reason` field.
  ///
  /// SCHEMA NOTE: the deployed contract (`packages/shared/src/types/replacement.ts`)
  /// has NO `description` field, and the admin detail screen renders `reason`
  /// with `whitespace-pre-line` — i.e. it already expects a multi-line blob. So
  /// the chosen option and the customer's own words are composed into one field
  /// rather than inventing a column the admin panel would never show.
  String get composedReason =>
      description.trim().isEmpty ? reason : '$reason\n\n${description.trim()}';

  @override
  List<Object?> get props => [
        orderId,
        userName,
        userPhone,
        userEmail,
        productId,
        productName,
        productImage,
        variantId,
        variantName,
        variantColor,
        quantity,
        reason,
        description,
        photos,
      ];
}
