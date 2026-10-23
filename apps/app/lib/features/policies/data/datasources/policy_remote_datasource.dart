import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/firebase_error_message.dart';
import '../models/policy_model.dart';

/// Reads customer-facing policies from `policies/{id}`.
/// The ONLY place these Firebase reads live (skill: Firebase in datasources
/// only).
abstract class PolicyRemoteDataSource {
  /// Every enabled policy in display order. Throws [ServerException] on a read
  /// failure.
  Future<List<PolicyModel>> getEnabledPolicies();

  /// One policy, or null when it does not exist / is not enabled. Throws
  /// [ServerException] on any other read failure.
  Future<PolicyModel?> getPolicy(String policyId);
}

@LazySingleton(as: PolicyRemoteDataSource)
class PolicyRemoteDataSourceImpl implements PolicyRemoteDataSource {
  PolicyRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  /// `PolicyStatus.ENABLED` in packages/shared/src/config/enums.ts.
  static const _enabled = 'enabled';

  /// `POLICY_LIST_LIMIT` in packages/shared/src/config/policies.ts — the most
  /// policies the store may hold, so the list is one bounded read with no
  /// pagination.
  static const _listLimit = 50;

  CollectionReference<Map<String, dynamic>> get _policies =>
      _firestore.collection(FirebaseCollections.policies);

  /// WHY the `status == 'enabled'` filter is mandatory, not an optimisation:
  /// the rules allow reading a policy only while it is enabled, and Firestore
  /// checks rules against the QUERY, not the documents it happens to return. A
  /// query that could match a disabled doc is rejected outright with
  /// permission-denied, even if every policy is currently enabled.
  @override
  Future<List<PolicyModel>> getEnabledPolicies() async {
    try {
      final snap = await _policies
          .where('status', isEqualTo: _enabled)
          .orderBy('order')
          .limit(_listLimit)
          .get();
      return snap.docs.map(PolicyModel.fromFirestore).toList();
    } on FirebaseException catch (e) {
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load policies.',
        e.code,
      );
    }
  }

  /// WHY permission-denied is returned as null rather than thrown: the rules
  /// hide a disabled policy by refusing the read, so to a customer a disabled
  /// policy and a missing one are the same thing — "not available". Only a
  /// genuine failure (offline, backend unavailable) surfaces as an error, so the
  /// screen can offer a retry instead of claiming the policy does not exist.
  @override
  Future<PolicyModel?> getPolicy(String policyId) async {
    // `doc()` asserts on an id containing '/' (it would address a
    // sub-collection), so a malformed deep link must not reach it.
    if (policyId.isEmpty || policyId.contains('/')) return null;

    try {
      final doc = await _policies.doc(policyId).get();
      if (!doc.exists) return null;
      // Belt-and-braces: the rules already refuse a disabled policy, but the
      // UI must not show one even if that rule is ever loosened.
      if (doc.data()?['status'] != _enabled) return null;
      return PolicyModel.fromFirestore(doc);
    } on FirebaseException catch (e) {
      if (e.code == 'permission-denied') return null;
      throw ServerException(
        FirebaseErrorMessage.of(e) ?? 'Could not load this policy.',
        e.code,
      );
    }
  }
}
