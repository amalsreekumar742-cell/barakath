import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../domain/entities/address.dart';
import '../models/address_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// CRUD over `users/{uid}/addresses` (spec §2.14). The uid is taken from the
/// signed-in session, never from a caller argument — the rules only allow a
/// customer to touch their own subtree, and passing it in would invite a bug
/// that writes to someone else's.
abstract class AddressRemoteDataSource {
  Future<List<Address>> fetchAddresses({int limit = 20});
  Future<Address> addAddress(Address address);
  Future<void> updateAddress(Address address);
  Future<void> deleteAddress(String addressId);
  Future<void> setDefault(String addressId);
}

@LazySingleton(as: AddressRemoteDataSource)
class AddressRemoteDataSourceImpl implements AddressRemoteDataSource {
  AddressRemoteDataSourceImpl(this._firestore, this._auth);

  final FirebaseFirestore _firestore;
  final fb_auth.FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _collection {
    final uid = _auth.currentUser?.uid;
    if (uid == null) throw const AuthException('Please sign in to manage addresses.');
    return _firestore
        .collection(FirebaseCollections.users)
        .doc(uid)
        .collection(FirebaseCollections.addresses);
  }

  @override
  Future<List<Address>> fetchAddresses({int limit = 20}) async {
    try {
      final snap =
          await _collection.orderBy('createdAt', descending: true).limit(limit).get();
      return snap.docs.map(AddressModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load your addresses.', e.code);
    }
  }

  @override
  Future<Address> addAddress(Address address) async {
    try {
      final ref = _collection.doc();
      final batch = _firestore.batch();
      // Exactly one default: clear the others in the SAME batch, so a crash can
      // never leave two addresses both claiming to be the default.
      if (address.isDefault) await _queueClearDefaults(batch);
      batch.set(ref, {
        ...AddressModel.fromEntity(address).toFirestore(withCreatedAt: true),
        'createdAt': FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return AddressModel.fromEntity(address).copyWithId(ref.id);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not save the address.', e.code);
    }
  }

  @override
  Future<void> updateAddress(Address address) async {
    try {
      final batch = _firestore.batch();
      if (address.isDefault) await _queueClearDefaults(batch);
      batch.update(
        _collection.doc(address.id),
        AddressModel.fromEntity(address).toFirestore(),
      );
      await batch.commit();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not update the address.', e.code);
    }
  }

  @override
  Future<void> deleteAddress(String addressId) async {
    try {
      final removed = await _collection.doc(addressId).get();
      final wasDefault = removed.data()?['isDefault'] == true;
      await _collection.doc(addressId).delete();

      // Never leave the customer with addresses but no default — checkout would
      // then open with nothing pre-selected. Spec §2.14: the NEXT OLDEST takes
      // over, so order ascending here (not descending, which picks the newest).
      if (!wasDefault) return;
      final remaining =
          await _collection.orderBy('createdAt').limit(1).get();
      if (remaining.docs.isNotEmpty) {
        await remaining.docs.first.reference.update({'isDefault': true});
      }
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not delete the address.', e.code);
    }
  }

  @override
  Future<void> setDefault(String addressId) async {
    try {
      final batch = _firestore.batch();
      await _queueClearDefaults(batch);
      batch.update(_collection.doc(addressId), {'isDefault': true});
      await batch.commit();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not set the default address.', e.code);
    }
  }

  /// Queue an unset of every current default onto [batch] (read first, since
  /// Firestore batches can't read).
  Future<void> _queueClearDefaults(WriteBatch batch) async {
    final current = await _collection.where('isDefault', isEqualTo: true).get();
    for (final doc in current.docs) {
      batch.update(doc.reference, {'isDefault': false});
    }
  }
}
