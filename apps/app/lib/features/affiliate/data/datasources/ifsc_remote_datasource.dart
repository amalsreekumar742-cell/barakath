import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:http/http.dart' as http;
import 'package:injectable/injectable.dart';

import '../../../../core/error/exceptions.dart';
import '../models/ifsc_details_model.dart';

/// Resolves an IFSC code to a bank + branch through Razorpay's free, public
/// IFSC directory (spec §2.22 "IFSC (auto-verify)").
///
/// WHY plain `http` and not `cloud_functions`: this is an unauthenticated GET
/// against a third-party host — routing it through a callable would add a cold
/// start and a Firebase dependency for a lookup that needs neither.
abstract class IfscRemoteDataSource {
  /// 200 → the bank details. 404 → [ServerException] ("invalid code").
  /// No connection → [NetworkException].
  Future<IfscDetailsModel> verifyIfsc(String ifsc);
}

@LazySingleton(as: IfscRemoteDataSource)
class IfscRemoteDataSourceImpl implements IfscRemoteDataSource {
  /// Owns its own client: `core/di/register_module.dart` does not expose an
  /// `http.Client` (this is the app's only REST call) and that module is out of
  /// this feature's scope. Swap it in tests via [IfscRemoteDataSourceImpl.withClient].
  IfscRemoteDataSourceImpl() : _client = http.Client();

  @visibleForTesting
  IfscRemoteDataSourceImpl.withClient(this._client);

  final http.Client _client;

  static const String _host = 'ifsc.razorpay.com';
  static const Duration _timeout = Duration(seconds: 12);

  @override
  Future<IfscDetailsModel> verifyIfsc(String ifsc) async {
    final code = ifsc.trim().toUpperCase();
    if (code.length != 11) {
      throw const ServerException('An IFSC code is 11 characters.');
    }

    try {
      final response = await _client
          .get(Uri.https(_host, '/$code'))
          .timeout(_timeout);

      if (response.statusCode == 404) {
        throw const ServerException(
          "We couldn't find a bank for this IFSC code. Please check it.",
        );
      }
      if (response.statusCode != 200) {
        throw const ServerException(
          "We couldn't verify the IFSC code right now. Please try again.",
        );
      }

      final decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) {
        throw const ServerException(
          "We couldn't find a bank for this IFSC code. Please check it.",
        );
      }
      final details = IfscDetailsModel.fromJson(decoded);
      if (details.bank.isEmpty) {
        throw const ServerException(
          "We couldn't find a bank for this IFSC code. Please check it.",
        );
      }
      // The directory echoes the code back; fall back to what was typed if not.
      return details.ifsc.isEmpty
          ? IfscDetailsModel(
              ifsc: code,
              bank: details.bank,
              branch: details.branch,
            )
          : details;
    } on SocketException {
      throw const NetworkException(
        'No internet connection — we could not verify the IFSC code.',
      );
    } on http.ClientException {
      throw const NetworkException(
        'No internet connection — we could not verify the IFSC code.',
      );
    } on TimeoutException {
      throw const NetworkException(
        'The IFSC check timed out. Please check your connection and try again.',
      );
    } on FormatException {
      throw const ServerException(
        "We couldn't read the bank details for this IFSC code.",
      );
    }
  }
}
