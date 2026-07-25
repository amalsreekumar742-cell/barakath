import 'package:dartz/dartz.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/address.dart';
import '../../domain/usecases/address_usecases.dart';

/// Saved delivery addresses (spec §2.14). Every mutation re-reads the list so
/// the default flag the server actually holds is what the UI shows — the
/// "exactly one default" rule is enforced in a batch down in the datasource.
@injectable
class AddressProvider extends ChangeNotifier {
  AddressProvider(
    this._getAddresses,
    this._addAddress,
    this._updateAddress,
    this._deleteAddress,
    this._setDefaultAddress,
  );

  final GetAddresses _getAddresses;
  final AddAddress _addAddress;
  final UpdateAddress _updateAddress;
  final DeleteAddress _deleteAddress;
  final SetDefaultAddress _setDefaultAddress;

  List<Address> _addresses = [];
  bool _isLoading = true;
  bool _isSaving = false;
  String? _error;

  List<Address> get addresses => List.unmodifiable(_addresses);
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get error => _error;

  /// The address checkout should pre-select: the default, else the newest.
  Address? get defaultAddress {
    if (_addresses.isEmpty) return null;
    for (final a in _addresses) {
      if (a.isDefault) return a;
    }
    return _addresses.first;
  }

  Address? byId(String id) {
    for (final a in _addresses) {
      if (a.id == id) return a;
    }
    return null;
  }

  Future<void> fetchAddresses() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final result = await _getAddresses(const NoParams());
    result.fold(
      (failure) => _error = failure.message,
      (list) => _addresses = list,
    );

    _isLoading = false;
    notifyListeners();
  }

  /// Returns the saved address on success, or null with [error] set.
  Future<Address?> addAddress(Address address) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    final result = await _addAddress(address);
    Address? saved;
    result.fold(
      (failure) => _error = failure.message,
      (created) => saved = created,
    );

    _isSaving = false;
    if (saved != null) {
      await fetchAddresses();
    } else {
      notifyListeners();
    }
    return saved;
  }

  Future<bool> updateAddress(Address address) =>
      _mutate(() => _updateAddress(address));

  Future<bool> deleteAddress(String addressId) =>
      _mutate(() => _deleteAddress(addressId));

  Future<bool> setDefault(String addressId) =>
      _mutate(() => _setDefaultAddress(addressId));

  /// Run a mutation, refresh on success, and report whether it worked.
  Future<bool> _mutate(Future<Either<Failure, Object?>> Function() run) async {
    _isSaving = true;
    _error = null;
    notifyListeners();

    final result = await run();
    var ok = false;
    result.fold((failure) => _error = failure.message, (_) => ok = true);

    _isSaving = false;
    if (ok) {
      await fetchAddresses();
    } else {
      notifyListeners();
    }
    return ok;
  }
}
