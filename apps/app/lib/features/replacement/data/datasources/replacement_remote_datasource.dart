import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/services/storage_service.dart';
import '../../../../core/utils/model_parse.dart';
import '../../domain/entities/replacement_draft.dart';
import '../models/replacement_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The ONLY place the replacement feature touches Firebase.
///
/// WRITE ORDER — and why it is NOT create-then-update:
/// `firestore.rules` gives `replacements/{id}` `allow update: if isAdmin()`, so a
/// customer gets exactly ONE write: the create. The document id is therefore
/// allocated client-side with `collection().doc()` (which mints an id without
/// writing), the photos are uploaded under that id, and the document is created
/// once with the finished URL list. A create → upload → update sequence would
/// fail permission-denied on the update and strand a photo-less request.
abstract class ReplacementRemoteDataSource {
  Future<ReplacementModel> submitRequest(ReplacementDraft draft);
}

@LazySingleton(as: ReplacementRemoteDataSource)
class ReplacementRemoteDataSourceImpl implements ReplacementRemoteDataSource {
  ReplacementRemoteDataSourceImpl(this._auth, this._firestore, this._storage);

  final fb_auth.FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final StorageService _storage;

  String get _requireUid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw const AuthException('Please log in to raise a return request.');
    }
    return uid;
  }

  @override
  Future<ReplacementModel> submitRequest(ReplacementDraft draft) async {
    final uid = _requireUid;

    final docRef =
        _firestore.collection(FirebaseCollections.replacements).doc();
    final requestId = await _nextRequestId(docRef.id);

    // Photos first: a request whose evidence failed to upload should never be
    // created at all, because the customer cannot retry into the same document.
    final photoUrls = await _uploadPhotos(draft, docRef.id);

    final model = ReplacementModel(
      id: docRef.id,
      requestId: requestId,
      orderId: draft.orderId,
      userId: uid,
      userName: draft.userName,
      userPhone: draft.userPhone,
      userEmail: draft.userEmail,
      productId: draft.productId,
      productName: draft.productName,
      productImage: draft.productImage,
      variantId: draft.variantId,
      variantName: draft.variantName,
      variantColor: draft.variantColor,
      quantity: draft.quantity,
      reason: draft.composedReason,
      photos: photoUrls,
      status: 'Pending',
      adminNote: '',
      replacementOrderId: '',
      processedBy: '',
      processedByName: '',
      processedAt: null,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );

    try {
      await docRef.set(model.toFirestore());
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not submit your return request.',
        e.code,
      );
    }
    return model;
  }

  Future<List<String>> _uploadPhotos(
    ReplacementDraft draft,
    String docId,
  ) async {
    if (draft.photos.isEmpty) return const [];
    try {
      return await _storage.uploadImages(
        draft.photos,
        StoragePaths.replacementPrefix(docId),
      );
    } on FirebaseException catch (e) {
      // KNOWN BLOCKER: storage.rules gives `replacements/{requestId}/{fileName}`
      // `allow read: if isAdmin()`, and `getDownloadURL()` is a read — so the
      // bytes upload but the URL fetch comes back permission-denied for a
      // customer. The rule needs widening to the signed-in owner. Reported to
      // the coordinator; do NOT paper over it by storing an unusable gs:// path.
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not upload your photos.',
        e.code,
      );
    }
  }

  /// `#RP-` + a 4-digit counter (design map §4 conflict 5).
  ///
  /// PREFERRED source is a transaction on `general/config.replacementCounter`,
  /// exactly as briefed. There is no server-side counter — `functions/src` has no
  /// replacement-creation function at all (only `approveReplacement`, which
  /// resolves an existing request) — so this is the only shared counter available.
  ///
  /// BUT `firestore.rules` has `match /general/{docId} { allow write: if isAdmin() }`,
  /// so the transaction is denied for a customer. The fallback derives four
  /// stable digits from the document id: unique enough for a display reference,
  /// and it never blocks a return request on a rules gap.
  Future<String> _nextRequestId(String docId) async {
    final ref = _firestore
        .collection(FirebaseCollections.general)
        .doc(FirebaseCollections.configDoc);
    try {
      final next = await _firestore.runTransaction<int>((tx) async {
        final snap = await tx.get(ref);
        final current =
            ModelParse.toInt((snap.data() ?? const {})['replacementCounter']);
        tx.update(ref, {'replacementCounter': current + 1});
        return current + 1;
      });
      return _format(next);
    } catch (_) {
      return _format(docId.hashCode.abs() % 10000);
    }
  }

  String _format(int counter) =>
      '#RP-${(counter % 10000).toString().padLeft(4, '0')}';
}
