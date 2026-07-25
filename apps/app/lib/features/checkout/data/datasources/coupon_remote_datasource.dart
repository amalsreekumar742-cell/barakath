import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../domain/entities/coupon.dart';
import '../models/coupon_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// Reads the `coupons` collection for the checkout coupon picker.
abstract class CouponRemoteDataSource {
  /// Currently-live coupons, newest first. Bounded — the picker is not a browse
  /// surface, the customer either knows a code or takes one off the shortlist.
  Future<List<Coupon>> fetchActive({int limit = 30});

  /// A single coupon looked up by its code (case-insensitive by convention:
  /// codes are stored upper-case). Null when no such coupon exists.
  Future<Coupon?> findByCode(String code);
}

@LazySingleton(as: CouponRemoteDataSource)
class CouponRemoteDataSourceImpl implements CouponRemoteDataSource {
  CouponRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _coupons =>
      _firestore.collection(FirebaseCollections.coupons);

  @override
  Future<List<Coupon>> fetchActive({int limit = 30}) async {
    try {
      // `validUntil` is filtered client-side by the provider: adding a range
      // filter here on top of the isActive equality would need yet another
      // composite index for a list this small.
      final snap = await _coupons
          .where('isActive', isEqualTo: true)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .get();
      return snap.docs.map(CouponModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load coupons.', e.code);
    }
  }

  @override
  Future<Coupon?> findByCode(String code) async {
    try {
      final snap = await _coupons
          .where('code', isEqualTo: code.trim().toUpperCase())
          .limit(1)
          .get();
      if (snap.docs.isEmpty) return null;
      return CouponModel.fromFirestore(snap.docs.first);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not check that coupon.', e.code);
    }
  }
}
