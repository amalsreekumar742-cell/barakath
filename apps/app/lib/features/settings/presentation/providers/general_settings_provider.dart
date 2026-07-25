import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/general_settings.dart';
import '../../domain/usecases/get_general_settings.dart';

/// Loads and exposes the single `general/config` settings document (spec §1.21)
/// so any screen can read checkout math (delivery/GST), help contacts, legal
/// text and the version gate without re-fetching.
///
/// Calls the [GetGeneralSettings] use case — never Firestore directly. On
/// failure it keeps [GeneralSettings.empty] so convenience getters stay safe.
@injectable
class GeneralSettingsProvider extends ChangeNotifier {
  GeneralSettingsProvider(this._getGeneralSettings);

  final GetGeneralSettings _getGeneralSettings;

  GeneralSettings _settings = GeneralSettings.empty;
  bool _isLoading = false;
  bool _loadedOnce = false;

  GeneralSettings get settings => _settings;
  bool get isLoading => _isLoading;
  bool get loadedOnce => _loadedOnce;

  // --- Convenience getters delegating to the entity --------------------------
  List<DeliverySlab> get deliverySlabs => _settings.deliverySlabs;
  double get freeDeliveryThreshold => _settings.freeDeliveryThreshold;
  double get gstPercentage => _settings.gstPercentage;
  String get helpPhone => _settings.helpPhone;
  String get helpWhatsApp => _settings.helpWhatsApp;
  String get helpEmail => _settings.helpEmail;
  String get privacyPolicy => _settings.privacyPolicy;
  String get termsAndConditions => _settings.termsAndConditions;
  String get appMinVersion => _settings.appMinVersion;

  /// Fetch (or re-fetch) the settings document.
  Future<void> load() async {
    _isLoading = true;
    notifyListeners();
    final result = await _getGeneralSettings(const NoParams());
    result.fold(
      (_) {}, // keep safe defaults on failure
      (settings) => _settings = settings,
    );
    _isLoading = false;
    _loadedOnce = true;
    notifyListeners();
  }
}
