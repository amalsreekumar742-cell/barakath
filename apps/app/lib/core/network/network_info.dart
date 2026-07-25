import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:injectable/injectable.dart';

/// Connectivity abstraction used by repositories to check for internet before a
/// remote call (spec §2.25 global rules).
///
/// WHY an interface: datasources/repositories depend on [NetworkInfo], not on
/// `connectivity_plus` directly, so it's trivial to fake in tests. Any non-`none`
/// result counts as connected.
abstract class NetworkInfo {
  /// Whether the device currently has a usable connection.
  Future<bool> get isConnected;

  /// A boolean online/offline stream for UI banners.
  Stream<bool> get onStatusChange;
}

@LazySingleton(as: NetworkInfo)
class NetworkInfoImpl implements NetworkInfo {
  NetworkInfoImpl(this._connectivity);

  final Connectivity _connectivity;

  @override
  Future<bool> get isConnected async =>
      _isConnected(await _connectivity.checkConnectivity());

  @override
  Stream<bool> get onStatusChange =>
      _connectivity.onConnectivityChanged.map(_isConnected);

  bool _isConnected(List<ConnectivityResult> results) =>
      results.any((r) => r != ConnectivityResult.none);
}
