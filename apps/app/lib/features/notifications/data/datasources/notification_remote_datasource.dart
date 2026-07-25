import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../models/notification_model.dart';
import '../../../../core/error/firebase_error_message.dart';

/// One raw page plus its Firestore cursor. The `DocumentSnapshot` type never
/// leaves the data layer.
class NotificationPageDto {
  const NotificationPageDto({
    required this.items,
    required this.nextCursor,
    required this.hasMore,
  });

  final List<NotificationModel> items;
  final DocumentSnapshot<Map<String, dynamic>>? nextCursor;
  final bool hasMore;

  static const empty = NotificationPageDto(
    items: <NotificationModel>[],
    nextCursor: null,
    hasMore: false,
  );
}

/// The ONLY place the notification feed touches Firestore.
abstract class NotificationRemoteDataSource {
  Future<NotificationPageDto> getBroadcasts({
    required int limit,
    Object? startAfter,
  });

  Future<NotificationPageDto> getPersonal({
    required int limit,
    Object? startAfter,
  });
}

@LazySingleton(as: NotificationRemoteDataSource)
class NotificationRemoteDataSourceImpl implements NotificationRemoteDataSource {
  NotificationRemoteDataSourceImpl(this._firestore, this._auth);

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  CollectionReference<Map<String, dynamic>> get _collection =>
      _firestore.collection(FirebaseCollections.notifications);

  @override
  Future<NotificationPageDto> getBroadcasts({
    required int limit,
    Object? startAfter,
  }) async {
    // Shaped to the deployed composite index (targetType ASC, isSent ASC,
    // createdAt DESC) and to the read rule, which allows a signed-in customer
    // any document whose targetType is 'All'. `isSent` keeps scheduled/draft
    // broadcasts out of the feed before the admin sends them.
    var query = _collection
        .where('targetType', isEqualTo: 'All')
        .where('isSent', isEqualTo: true)
        .orderBy('createdAt', descending: true)
        .limit(limit);

    if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
      query = query.startAfterDocument(startAfter);
    }
    return _run(query, limit, 'Could not load notifications.');
  }

  @override
  Future<NotificationPageDto> getPersonal({
    required int limit,
    Object? startAfter,
  }) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return NotificationPageDto.empty;

    // Deployed index: (targetUserIds array-contains, createdAt DESC). No
    // `isSent` clause — that index does not carry the field, and a targeted
    // message only ever gets the customer's uid written into it when it is sent.
    var query = _collection
        .where('targetUserIds', arrayContains: uid)
        .orderBy('createdAt', descending: true)
        .limit(limit);

    if (startAfter is DocumentSnapshot<Map<String, dynamic>>) {
      query = query.startAfterDocument(startAfter);
    }
    return _run(query, limit, 'Could not load your notifications.');
  }

  Future<NotificationPageDto> _run(
    Query<Map<String, dynamic>> query,
    int limit,
    String errorMessage,
  ) async {
    try {
      final snap = await query.get();
      return NotificationPageDto(
        items: snap.docs.map(NotificationModel.fromFirestore).toList(),
        nextCursor: snap.docs.isEmpty ? null : snap.docs.last,
        // A short page means the stream is exhausted; a full one may not be.
        hasMore: snap.docs.length == limit,
      );
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? errorMessage, e.code);
    }
  }
}
