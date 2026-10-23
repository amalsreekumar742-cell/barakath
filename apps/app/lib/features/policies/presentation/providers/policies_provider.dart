import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/entities/policy.dart';
import '../../domain/usecases/get_policies.dart';
import '../../domain/usecases/get_policy.dart';

/// Explicit, named states for the Policies list (skill rule). `empty` is its
/// own state, not "loaded with zero items": until the admin migration runs the
/// collection is genuinely empty, and that must read as "nothing published
/// yet", never as a blank screen.
enum PoliciesListState { initial, loading, loaded, empty, error }

/// Explicit, named states for one policy. `notFound` covers missing AND
/// disabled — the rules make the two indistinguishable to a customer.
enum PolicyDetailState { initial, loading, loaded, notFound, error }

/// The customer-facing policies (admin Settings › Policies): the list behind
/// Settings › Policies and the single document behind each detail page.
///
/// Calls the [GetPolicies] / [GetPolicy] use cases — never Firestore directly.
///
/// WHY one provider for both: the list read already returns every policy's
/// full content, so opening one from the list renders instantly from that copy
/// instead of showing a shimmer for a document already in memory. The detail
/// read still runs behind it, so a policy edited or disabled since the list
/// loaded is corrected on screen.
@injectable
class PoliciesProvider extends ChangeNotifier {
  PoliciesProvider(this._getPolicies, this._getPolicy);

  final GetPolicies _getPolicies;
  final GetPolicy _getPolicy;

  // --- List ------------------------------------------------------------------
  PoliciesListState _listState = PoliciesListState.initial;
  List<Policy> _policies = const [];
  String? _listError;
  bool _listInFlight = false;

  PoliciesListState get listState => _listState;
  List<Policy> get policies => _policies;
  String? get listError => _listError;

  // --- Detail ----------------------------------------------------------------
  /// The id the detail state below belongs to. Every detail getter is keyed on
  /// it so a page can never render another policy's state.
  String? _detailId;
  PolicyDetailState _detailState = PolicyDetailState.initial;
  Policy? _detail;
  String? _detailError;

  PolicyDetailState detailStateOf(String policyId) =>
      _detailId == policyId ? _detailState : PolicyDetailState.initial;
  Policy? detailOf(String policyId) => _detailId == policyId ? _detail : null;
  String? detailErrorOf(String policyId) =>
      _detailId == policyId ? _detailError : null;

  /// Fetch (or re-fetch) every enabled policy.
  ///
  /// WHY a refresh keeps the current list on screen: the page re-loads on every
  /// visit so an admin's change shows up, but a returning customer should see
  /// the list they already had rather than a shimmer — and a failed refresh
  /// should not replace a perfectly good list with an error.
  Future<void> loadPolicies() async {
    if (_listInFlight) return;
    _listInFlight = true;

    final hasData = _listState == PoliciesListState.loaded;
    if (!hasData) {
      _listState = PoliciesListState.loading;
      _listError = null;
      notifyListeners();
    }

    final result = await _getPolicies(const NoParams());
    result.fold(
      (failure) {
        if (hasData) return;
        _listError = failure.message;
        _listState = PoliciesListState.error;
      },
      (policies) {
        _policies = policies;
        _listState =
            policies.isEmpty ? PoliciesListState.empty : PoliciesListState.loaded;
      },
    );
    _listInFlight = false;
    notifyListeners();
  }

  /// Load one policy for its detail page.
  Future<void> loadPolicy(String policyId) async {
    if (_detailId != policyId || _detail == null) {
      _detailId = policyId;
      _detailError = null;
      final cached = _cachedPolicy(policyId);
      _detail = cached;
      _detailState =
          cached != null ? PolicyDetailState.loaded : PolicyDetailState.loading;
      notifyListeners();
    }

    final result = await _getPolicy(policyId);
    // A newer request (another policy opened meanwhile) owns the state now.
    if (_detailId != policyId) return;

    result.fold(
      (failure) {
        // Already showing a copy (from the list or a previous visit) — keep it
        // rather than swapping readable text for an error.
        if (_detail != null) return;
        _detailError = failure.message;
        _detailState = PolicyDetailState.error;
      },
      (policy) {
        if (policy == null) {
          _detail = null;
          _detailState = PolicyDetailState.notFound;
          _dropFromList(policyId);
        } else {
          _detail = policy;
          _detailState = PolicyDetailState.loaded;
        }
      },
    );
    notifyListeners();
  }

  Policy? _cachedPolicy(String policyId) {
    for (final policy in _policies) {
      if (policy.id == policyId) return policy;
    }
    return null;
  }

  /// A policy disabled since the list loaded must not stay in it — tapping it
  /// again would only lead back to "not available".
  void _dropFromList(String policyId) {
    if (_cachedPolicy(policyId) == null) return;
    _policies = _policies.where((p) => p.id != policyId).toList();
    if (_policies.isEmpty && _listState == PoliciesListState.loaded) {
      _listState = PoliciesListState.empty;
    }
  }
}
