import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart' as fb_auth;
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/cloud_functions.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/utils/model_parse.dart';
import '../../../checkout/data/models/coupon_model.dart';
import '../../../checkout/domain/entities/coupon.dart';
import '../../domain/entities/coupon_wallet_status.dart';
import '../../domain/entities/customer_audience.dart';
import '../../domain/entities/spin_coupon_page.dart';
import '../../domain/entities/spin_result.dart';
import '../../domain/entities/spin_tally.dart';
import '../../domain/entities/spinner_campaign.dart';
import '../models/spin_result_model.dart';
import '../models/spinner_campaign_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// The one Firebase seam for Spin & Win.
///
/// Four collections/endpoints, all read-only from the client except the
/// callable: `spinnerCampaigns` (the wheel), `spinHistory` (how many spins are
/// left), `users/{uid}` (the audience gate), the `spinWheel` callable (the
/// spin itself), and `coupons` (the wallet). The app NEVER writes a coupon or a
/// history record — `spinWheel` does both with the Admin SDK.
abstract class SpinnerRemoteDataSource {
  /// The live campaign (`isActive == true` and now inside its date window), or
  /// null when nothing is running.
  Future<SpinnerCampaign?> fetchActiveCampaign();

  /// This customer's recorded spins on [campaignId] plus their latest one.
  Future<SpinTally> fetchSpinTally(String campaignId);

  /// `totalOrders` + `affiliateCode` off the user document.
  Future<CustomerAudience> fetchCustomerAudience();

  /// One spin. Returns whatever the server decided.
  Future<SpinResult> spin(String campaignId);

  /// A cursor page of this customer's `SPIN-` coupons in one wallet tab.
  Future<SpinCouponPage> fetchMyCoupons({
    required SpinRewardStatus status,
    Object? startAfter,
    int limit,
  });
}

@LazySingleton(as: SpinnerRemoteDataSource)
class SpinnerRemoteDataSourceImpl implements SpinnerRemoteDataSource {
  SpinnerRemoteDataSourceImpl(this._firestore, this._auth, this._functions);

  final FirebaseFirestore _firestore;
  final fb_auth.FirebaseAuth _auth;
  final FirebaseFunctions _functions;

  /// How many raw pages the wallet may walk while looking for [limit] rows of
  /// one status. The tab is a client-side filter (a `coupons` document has no
  /// status field), so a page can come back thin; this bounds the walk instead
  /// of letting it degenerate into a full-collection scan.
  static const int _maxWalletScanPages = 5;

  String get _uid {
    final uid = _auth.currentUser?.uid;
    if (uid == null) {
      throw const AuthException('Please sign in to spin and win.');
    }
    return uid;
  }

  @override
  Future<SpinnerCampaign?> fetchActiveCampaign() async {
    try {
      // The date window is applied in Dart, not in the query: an equality on
      // isActive plus a range on endDate would need a composite index that
      // isn't declared, and the declared (isActive, createdAt) one covers this.
      // Bounded at 10 — a store runs one campaign at a time, not a catalogue.
      final snap = await _firestore
          .collection(FirebaseCollections.spinnerCampaigns)
          .where('isActive', isEqualTo: true)
          .orderBy('createdAt', descending: true)
          .limit(10)
          .get();

      final now = DateTime.now();
      for (final doc in snap.docs) {
        final campaign = SpinnerCampaignModel.fromFirestore(doc);
        if (campaign.isLiveAt(now) && campaign.slots.isNotEmpty) return campaign;
      }
      return null;
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load the spin wheel.', e.code);
    }
  }

  @override
  Future<SpinTally> fetchSpinTally(String campaignId) async {
    try {
      final query = _firestore
          .collection(FirebaseCollections.spinHistory)
          .where('userId', isEqualTo: _uid)
          .where('campaignId', isEqualTo: campaignId);

      // count() is an aggregation — one billed summary, not one read per spin.
      final countSnap = await query.count().get();

      // The newest spin drives the cooldown countdown. limit(1), so it stays a
      // single document read however many times the customer has played.
      final lastSnap =
          await query.orderBy('createdAt', descending: true).limit(1).get();

      return SpinTally(
        count: countSnap.count ?? 0,
        lastSpinAt: lastSnap.docs.isEmpty
            ? null
            : ModelParse.dateTime(lastSnap.docs.first.data()['createdAt']),
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not check your spins.', e.code);
    }
  }

  @override
  Future<CustomerAudience> fetchCustomerAudience() async {
    try {
      final doc = await _firestore
          .collection(FirebaseCollections.users)
          .doc(_uid)
          .get();
      final data = doc.data() ?? const <String, dynamic>{};
      return CustomerAudience(
        totalOrders: ModelParse.toInt(data['totalOrders']),
        affiliateCode: ModelParse.toStr(data['affiliateCode']),
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not check your account.', e.code);
    }
  }

  @override
  Future<SpinResult> spin(String campaignId) async {
    try {
      final callable = _functions.httpsCallable(CloudFunctions.spinWheel);
      // The ONLY thing the client sends. The uid comes from the verified
      // callable auth context, and the winning wedge is drawn server-side.
      final response = await callable.call<Map<String, dynamic>>({
        'campaignId': campaignId,
      });
      return SpinResultModel.fromCallable(
        Map<String, dynamic>.from(response.data),
      );
    } on FirebaseFunctionsException catch (e) {
      // "Maximum spins reached", "This campaign has ended", "Please wait N
      // hours" — written for the customer, so surface them verbatim.
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not spin right now.', e.code);
    }
  }

  @override
  Future<SpinCouponPage> fetchMyCoupons({
    required SpinRewardStatus status,
    Object? startAfter,
    int limit = AppDimens.pageSize,
  }) async {
    try {
      final base = _firestore
          .collection(FirebaseCollections.coupons)
          // `createdBy` is the winner's uid — spinWheel stamps it when it mints
          // the coupon, which is what makes this collection a personal wallet.
          .where('createdBy', isEqualTo: _uid)
          .orderBy('createdAt', descending: true);

      final now = DateTime.now();
      final matched = <Coupon>[];
      DocumentSnapshot<Map<String, dynamic>>? cursor =
          startAfter is DocumentSnapshot<Map<String, dynamic>> ? startAfter : null;
      var hasMore = true;

      for (var page = 0; page < _maxWalletScanPages; page++) {
        Query<Map<String, dynamic>> query = base;
        if (cursor != null) query = query.startAfterDocument(cursor);

        final snap = await query.limit(limit).get();
        if (snap.docs.isEmpty) {
          hasMore = false;
          break;
        }
        cursor = snap.docs.last;
        hasMore = snap.docs.length == limit;

        for (final doc in snap.docs) {
          final coupon = CouponModel.fromFirestore(doc);
          // A `createdBy == uid` coupon that isn't a SPIN- code would be one the
          // customer somehow authored; the wallet is spin winnings only.
          if (!coupon.code.toUpperCase().startsWith('SPIN-')) continue;
          if (couponWalletStatus(coupon, now: now) != status) continue;
          matched.add(coupon);
        }

        if (matched.length >= limit || !hasMore) break;
      }

      return SpinCouponPage(
        items: matched,
        nextCursor: hasMore ? cursor : null,
        hasMore: hasMore,
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not load your coupons.', e.code);
    }
  }
}
