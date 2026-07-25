import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../presentation/utils/notification_router.dart';

/// FCM wiring: permission, device token, foreground display and deep-link taps
/// (spec §2.25 — "Notification permission asked after login", "FCM for push
/// notifications").
///
/// WHY nothing here runs itself: permission must be requested AFTER login, and
/// this class has no idea when that happens. The auth-success path calls
/// [requestPermissionAfterLogin]; the sign-out path calls [clearToken]. Wiring
/// them is deliberately left to the caller — see the two entry points below.
///
/// Navigation is likewise a callback ([onDeepLink]) rather than a GoRouter
/// reference: a service that imports the router turns every push into a
/// dependency on the whole route table.
@lazySingleton
class PushService {
  PushService(this._messaging, this._firestore, this._auth);

  final FirebaseMessaging _messaging;
  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  /// Android 8+ requires an explicit channel; without one, a foreground
  /// notification is silently dropped.
  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'barakath_default',
    'General notifications',
    description: 'Order updates, offers and rewards from Barakath.',
    importance: Importance.high,
  );

  /// Called with a go_router path whenever a push is tapped. Set this once from
  /// the widget that owns the router.
  void Function(String route)? onDeepLink;

  bool _initialized = false;
  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedSub;
  StreamSubscription<String>? _tokenSub;

  /// A route captured before [onDeepLink] was attached — a cold start from a
  /// push resolves before the first frame. Read it once via [takePendingRoute].
  String? _pendingRoute;

  /// The deep link a terminated-state push launched the app with, consumed
  /// exactly once so a later rebuild can't navigate again.
  String? takePendingRoute() {
    final route = _pendingRoute;
    _pendingRoute = null;
    return route;
  }

  // --- Setup ---------------------------------------------------------------

  /// Local-notification plugin, Android channel, iOS presentation options and
  /// the three message listeners. Safe to call more than once.
  ///
  /// This does NOT ask for permission — see [requestPermissionAfterLogin].
  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    try {
      await _local.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          iOS: DarwinInitializationSettings(
            // The app displays foreground messages itself via this plugin, so
            // the system is asked not to present them twice.
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
        onDidReceiveNotificationResponse: (response) =>
            _navigate(response.payload),
      );

      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(_channel);

      // iOS shows nothing in the foreground unless asked to.
      await _messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      _foregroundSub = FirebaseMessaging.onMessage.listen(_showLocal);
      _openedSub = FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => _navigate(_routeFor(message)),
      );

      // Cold start from a push: there is no listener for this one.
      final initial = await _messaging.getInitialMessage();
      if (initial != null) _navigate(_routeFor(initial));
    } catch (error) {
      // Push is best-effort. A device without Play Services (or a desktop
      // debug run) must not take the app down with it.
      debugPrint('PushService.initialize failed: $error');
    }
  }

  // --- The two entry points the auth flow must call -------------------------

  /// Ask for notification permission and register this device.
  ///
  /// CALL THIS FROM THE AUTH SUCCESS PATH, never at app start: spec §2.25 says
  /// the permission prompt comes AFTER login. Asking on first launch burns the
  /// one prompt iOS and Android 13+ give you on a customer who has not yet seen
  /// a reason to say yes.
  ///
  /// Returns true when notifications are authorised (provisional counts).
  Future<bool> requestPermissionAfterLogin() async {
    try {
      await initialize();

      final settings = await _messaging.requestPermission();
      final granted = settings.authorizationStatus ==
              AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;

      if (granted) {
        await _saveToken();
        // A rotated token is worthless until it is written back — without this,
        // pushes stop the first time FCM re-registers the device.
        await _tokenSub?.cancel();
        _tokenSub = _messaging.onTokenRefresh.listen(_writeToken);
      }
      return granted;
    } catch (error) {
      debugPrint('PushService.requestPermissionAfterLogin failed: $error');
      return false;
    }
  }

  /// Detach this device from the account.
  ///
  /// CALL THIS FROM THE SIGN-OUT PATH, *before* `FirebaseAuth.signOut()` — once
  /// the session is gone the rules no longer allow the write, and the phone
  /// would keep receiving the previous customer's notifications.
  Future<void> clearToken() async {
    await _tokenSub?.cancel();
    _tokenSub = null;
    try {
      await _writeToken('');
      await _messaging.deleteToken();
    } catch (error) {
      debugPrint('PushService.clearToken failed: $error');
    }
  }

  // --- Token ---------------------------------------------------------------

  Future<void> _saveToken() async {
    final token = await _messaging.getToken();
    if (token == null || token.isEmpty) return;
    await _writeToken(token);
  }

  /// `users/{uid}.fcmToken`. `update` (not `set(merge:)`) because the rules only
  /// let a customer touch a whitelist of fields on a document that must already
  /// exist. Failures are swallowed: push registration must never block sign-in.
  Future<void> _writeToken(String token) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;
    try {
      await _firestore
          .collection(FirebaseCollections.users)
          .doc(uid)
          .update({'fcmToken': token, 'updatedAt': FieldValue.serverTimestamp()});
    } catch (error) {
      debugPrint('PushService could not write fcmToken: $error');
    }
  }

  // --- Messages ------------------------------------------------------------

  /// A foreground message is not displayed by the OS, so it is re-raised
  /// through flutter_local_notifications with the resolved route as its payload.
  Future<void> _showLocal(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title']?.toString() ?? '';
    final body = notification?.body ?? message.data['body']?.toString() ?? '';
    if (title.isEmpty && body.isEmpty) return;

    try {
      await _local.show(
        // A stable-ish id derived from the message keeps a re-delivery from
        // stacking duplicates, without needing a counter that survives restarts.
        message.messageId.hashCode,
        title.isEmpty ? null : title,
        body.isEmpty ? null : body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _channel.id,
            _channel.name,
            channelDescription: _channel.description,
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: _routeFor(message),
      );
    } catch (error) {
      debugPrint('PushService could not show a notification: $error');
    }
  }

  /// The data payload carries `linkType` / `linkValue` — the same two fields the
  /// `notifications` document uses — so pushes and list taps resolve identically.
  String _routeFor(RemoteMessage message) => resolveDeepLinkRoute(
        linkType: message.data['linkType']?.toString(),
        linkValue: message.data['linkValue']?.toString(),
      );

  void _navigate(String? route) {
    if (route == null || route.isEmpty) return;
    final handler = onDeepLink;
    if (handler == null) {
      _pendingRoute = route; // router not attached yet (cold start)
      return;
    }
    handler(route);
  }

  /// Detaches every listener. The service is a lazy singleton for the app's
  /// lifetime, so this only runs in tests / a DI reset.
  Future<void> dispose() async {
    await _foregroundSub?.cancel();
    await _openedSub?.cancel();
    await _tokenSub?.cancel();
  }
}
