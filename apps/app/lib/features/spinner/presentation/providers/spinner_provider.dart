import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../checkout/domain/entities/coupon.dart';
import '../../domain/entities/spin_availability.dart';
import '../../domain/entities/spin_result.dart';
import '../../domain/entities/spinner_campaign.dart';
import '../../domain/usecases/get_active_campaign.dart';
import '../../domain/usecases/get_my_coupons.dart';
import '../../domain/usecases/get_spin_availability.dart';
import '../../domain/usecases/spin_the_wheel.dart';

/// The named states of the Spin screen. Loading/empty/error are explicit rather
/// than inferred from null checks, per the architecture skill.
enum SpinViewState {
  /// Nothing fetched yet.
  idle,

  /// First load — the page shows a shimmer.
  loading,

  /// A live campaign is loaded and the wheel can render.
  ready,

  /// Nothing is running. Message-only empty state, no spin button.
  noCampaign,

  /// The fetch failed. Message + retry.
  error,
}

/// The named states of the coupon wallet list.
enum CouponsViewState { idle, loading, loaded, error }

/// Active campaign, wheel slots, spins remaining, spin result, coupon wallet.
///
/// THE CLIENT NEVER PICKS A WINNER. [spin] calls the `spinWheel` callable and
/// returns whatever the server decided; the page then aims the wheel animation
/// at that wedge. [spinsRemaining] is likewise re-read from `spinHistory` after
/// every spin instead of being decremented locally, so it can never drift from
/// the cap the callable enforces.
@injectable
class SpinnerProvider extends ChangeNotifier {
  SpinnerProvider(
    this._getActiveCampaign,
    this._getSpinAvailability,
    this._spinTheWheel,
    this._getMyCoupons,
  );

  final GetActiveCampaign _getActiveCampaign;
  final GetSpinAvailability _getSpinAvailability;
  final SpinTheWheel _spinTheWheel;
  final GetMyCoupons _getMyCoupons;

  // --- Spin state ------------------------------------------------------------

  SpinViewState _state = SpinViewState.idle;
  SpinnerCampaign? _campaign;
  SpinAvailability _availability = SpinAvailability.none;
  bool _isSpinning = false;
  SpinResult? _lastReward;
  String? _error;

  SpinViewState get state => _state;
  SpinnerCampaign? get campaign => _campaign;
  List<SpinnerSlot> get slots => _campaign?.slots ?? const [];
  SpinAvailability get availability => _availability;
  int get spinsRemaining => _availability.spinsRemaining;
  bool get isEligible => _availability.isEligible;
  String? get ineligibleMessage => _availability.ineligibleMessage;
  int get cooldownHoursRemaining => _availability.cooldownHoursRemaining;

  bool get isLoading => _state == SpinViewState.loading;

  /// True only while the callable is in flight. The wheel animation that
  /// follows is the page's own concern.
  bool get isSpinning => _isSpinning;

  SpinResult? get lastReward => _lastReward;
  String? get error => _error;

  /// Is the button live? The same three gates `spinWheel` applies.
  bool get canSpin =>
      _state == SpinViewState.ready && !_isSpinning && _availability.canSpin;

  /// Loads the campaign and, when one is live, its availability.
  Future<void> loadSpin() async {
    _state = SpinViewState.loading;
    _error = null;
    notifyListeners();

    final result = await _getActiveCampaign(const NoParams());
    final campaign = result.fold(
      (failure) {
        _error = failure.message;
        return null;
      },
      (campaign) => campaign,
    );

    if (_error != null) {
      _state = SpinViewState.error;
      notifyListeners();
      return;
    }

    _campaign = campaign;
    if (campaign == null) {
      _availability = SpinAvailability.none;
      _state = SpinViewState.noCampaign;
      notifyListeners();
      return;
    }

    await _loadAvailability(campaign, notify: false);
    _state = SpinViewState.ready;
    notifyListeners();
  }

  /// Re-reads spins remaining / cooldown from the server. Called after every
  /// spin — a local `-1` would be a guess, and a guess that disagrees with the
  /// callable is a button that errors on tap.
  Future<void> refreshAvailability() async {
    final campaign = _campaign;
    if (campaign == null) return;
    await _loadAvailability(campaign, notify: true);
  }

  Future<void> _loadAvailability(
    SpinnerCampaign campaign, {
    required bool notify,
  }) async {
    final result = await _getSpinAvailability(campaign);
    result.fold(
      (failure) => _error = failure.message,
      (availability) {
        _availability = availability;
        _error = null;
      },
    );
    if (notify) notifyListeners();
  }

  /// Runs one spin. Returns the server's result, or null when the call failed —
  /// in which case [error] holds the callable's own message and the wheel must
  /// NOT animate.
  Future<SpinResult?> spin() async {
    final campaign = _campaign;
    if (campaign == null || _isSpinning) return null;

    _isSpinning = true;
    _error = null;
    notifyListeners();

    final result = await _spinTheWheel(campaign.id);
    final reward = result.fold(
      (failure) {
        _error = failure.message;
        return null;
      },
      (reward) {
        _lastReward = reward;
        return reward;
      },
    );

    _isSpinning = false;
    notifyListeners();
    return reward;
  }

  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }

  // --- Coupon wallet ---------------------------------------------------------

  CouponsViewState _couponsState = CouponsViewState.idle;
  SpinRewardStatus _couponTab = SpinRewardStatus.active;
  List<Coupon> _coupons = [];
  Object? _couponsCursor;
  bool _couponsHasMore = false;
  bool _couponsLoadingMore = false;
  String? _couponsError;

  CouponsViewState get couponsState => _couponsState;
  SpinRewardStatus get couponTab => _couponTab;
  List<Coupon> get coupons => List.unmodifiable(_coupons);
  bool get couponsLoading => _couponsState == CouponsViewState.loading;
  bool get couponsLoadingMore => _couponsLoadingMore;
  bool get couponsHasMore => _couponsHasMore;
  String? get couponsError => _couponsError;

  /// Switches tab and reloads. Each tab keeps its own cursor, so Used doesn't
  /// inherit Active's paging position.
  Future<void> setCouponTab(SpinRewardStatus tab) async {
    if (_couponTab == tab) return;
    _couponTab = tab;
    await loadCoupons();
  }

  /// First page of the current tab.
  Future<void> loadCoupons() async {
    _couponsState = CouponsViewState.loading;
    _couponsError = null;
    _coupons = [];
    _couponsCursor = null;
    _couponsHasMore = false;
    notifyListeners();

    final result = await _getMyCoupons(
      MyCouponsParams(status: _couponTab, limit: AppDimens.pageSize),
    );
    result.fold(
      (failure) {
        _couponsError = failure.message;
        _couponsState = CouponsViewState.error;
      },
      (page) {
        _coupons = List.of(page.items);
        _couponsCursor = page.nextCursor;
        _couponsHasMore = page.hasMore;
        _couponsState = CouponsViewState.loaded;
      },
    );
    notifyListeners();
  }

  /// Next cursor page, appended.
  Future<void> loadMoreCoupons() async {
    if (_couponsLoadingMore || !_couponsHasMore || _couponsCursor == null) return;

    _couponsLoadingMore = true;
    notifyListeners();

    final result = await _getMyCoupons(
      MyCouponsParams(
        status: _couponTab,
        startAfter: _couponsCursor,
        limit: AppDimens.pageSize,
      ),
    );
    result.fold(
      (failure) => _couponsError = failure.message,
      (page) {
        _coupons = [..._coupons, ...page.items];
        _couponsCursor = page.nextCursor;
        _couponsHasMore = page.hasMore;
      },
    );

    _couponsLoadingMore = false;
    notifyListeners();
  }
}
