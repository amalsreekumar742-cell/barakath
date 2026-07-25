import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/cloud_functions.dart';

/// Third-party singletons that can't be annotated directly (Firebase SDK
/// instances, connectivity, SharedPreferences). Injectable registers each getter
/// so datasources constructor-inject them (`this._firestore`) instead of reaching
/// for `.instance` — a single seam that's trivial to fake in tests.
@module
abstract class RegisterModule {
  @lazySingleton
  FirebaseAuth get firebaseAuth => FirebaseAuth.instance;

  @lazySingleton
  FirebaseFirestore get firestore => FirebaseFirestore.instance;

  @lazySingleton
  FirebaseStorage get storage => FirebaseStorage.instance;

  @lazySingleton
  FirebaseMessaging get messaging => FirebaseMessaging.instance;

  @lazySingleton
  Connectivity get connectivity => Connectivity();

  /// Region-pinned to `asia-south1` — the Barakath callables live there, so a
  /// default (us-central1) instance would 404.
  @lazySingleton
  FirebaseFunctions get functions =>
      FirebaseFunctions.instanceFor(region: CloudFunctions.region);

  /// Async singleton — resolved once during `configureDependencies()` so the
  /// cart datasource can depend on it synchronously afterwards.
  @preResolve
  Future<SharedPreferences> get prefs => SharedPreferences.getInstance();
}
