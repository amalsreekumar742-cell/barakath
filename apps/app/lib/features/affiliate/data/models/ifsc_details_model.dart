import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/ifsc_details.dart';

/// Maps the Razorpay IFSC directory response
/// (`GET https://ifsc.razorpay.com/{IFSC}`) onto [IfscDetails].
///
/// The payload carries ~15 keys (MICR, ADDRESS, CONTACT, UPI…); only the bank
/// and branch are stored on the account document, so only those are parsed.
class IfscDetailsModel extends IfscDetails {
  const IfscDetailsModel({
    required super.ifsc,
    required super.bank,
    required super.branch,
  });

  factory IfscDetailsModel.fromJson(Map<String, dynamic> json) {
    return IfscDetailsModel(
      ifsc: ModelParse.toStr(json['IFSC']).toUpperCase(),
      bank: ModelParse.toStr(json['BANK']),
      branch: ModelParse.toStr(json['BRANCH']),
    );
  }
}
