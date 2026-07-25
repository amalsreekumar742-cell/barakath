import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../models/general_settings_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// Reads the single `general/config` settings document from Firestore.
/// The ONLY place this Firebase read lives (skill: Firebase in datasources only).
abstract class SettingsRemoteDataSource {
  /// Throws [ServerException] on any read/parse failure.
  Future<GeneralSettingsModel> getSettings();
}

@LazySingleton(as: SettingsRemoteDataSource)
class SettingsRemoteDataSourceImpl implements SettingsRemoteDataSource {
  SettingsRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  @override
  Future<GeneralSettingsModel> getSettings() async {
    try {
      final doc = await _firestore
          .collection(FirebaseCollections.general)
          .doc(FirebaseCollections.configDoc)
          .get();
      return GeneralSettingsModel.fromFirestore(doc);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load settings.', e.code);
    }
  }
}
