import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../domain/entities/wallet_breakdown.dart';
import '../../domain/entities/wallet_top_up_order.dart';
import '../../domain/entities/wallet_transaction.dart';
import '../../domain/usecases/create_wallet_top_up_order.dart';
import '../../domain/usecases/get_wallet_breakdown.dart';
import '../../domain/usecases/get_wallet_transactions.dart';
import '../../domain/usecases/verify_wallet_top_up.dart';
import '../../domain/usecases/watch_wallet_balance.dart';

/// Drives the Normal Wallet tab (spec §2.20): a live balance, the Rewards +
/// Refunds breakdown, and the cursor-paginated ledger.
///
/// It calls use cases only — never a repository, a datasource or Firestore — and
/// folds every `Either` into named state the widgets read. The balance arrives
/// on a subscription that is cancelled in [dispose].
@injectable
class WalletProvider extends ChangeNotifier {
  WalletProvider(
    this._watchBalance,
    this._getTransactions,
    this._getBreakdown,
    this._createTopUpOrder,
    this._verifyTopUp,
  );

  final WatchWalletBalance _watchBalance;
  final GetWalletTransactions _getTransactions;
  final GetWalletBreakdown _getBreakdown;
  final CreateWalletTopUpOrder _createTopUpOrder;
  final VerifyWalletTopUp _verifyTopUp;

  // --- State ---------------------------------------------------------------
  String _uid = '';
  double _balance = 0;
  List<WalletTransaction> _transactions = const [];
  WalletBreakdown _breakdown = WalletBreakdown.empty;

  bool _loadedOnce = false;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _isToppingUp = false;
  bool _hasMore = false;
  Object? _cursor;
  String? _error;

  StreamSubscription<double>? _balanceSub;

  // --- Getters -------------------------------------------------------------
  String get uid => _uid;
  double get balance => _balance;
  List<WalletTransaction> get transactions => _transactions;
  WalletBreakdown get breakdown => _breakdown;
  double get rewardsTotal => _breakdown.rewardsTotal;

  /// First-page load — drives the shimmer. Later pages use [isLoadingMore].
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;

  /// A top-up is in flight — drives the "Add ₹X" button's loading state.
  bool get isToppingUp => _isToppingUp;
  bool get hasMore => _hasMore;

  /// The opaque cursor for the next page (a Firestore `DocumentSnapshot` the
  /// data layer minted); null once the ledger is exhausted.
  Object? get cursor => _cursor;
  String? get error => _error;

  /// Start (or restart) the tab for a signed-in customer: subscribe to the
  /// balance, then load page 1 of the ledger and the two aggregates.
  Future<void> init(String uid) async {
    if (uid.isEmpty) return;
    // Same customer, already read — a tab switch shouldn't re-page the ledger.
    // An EMPTY ledger counts as loaded, hence the flag rather than a list check.
    if (uid == _uid && (_loadedOnce || _isLoading)) return;

    if (uid != _uid) {
      // A different account: drop the previous customer's data immediately
      // rather than letting it show under the new balance.
      _uid = uid;
      _transactions = const [];
      _breakdown = WalletBreakdown.empty;
      _balance = 0;
      _cursor = null;
      _hasMore = false;
      _loadedOnce = false;
    }

    await _balanceSub?.cancel();
    _balanceSub = _watchBalance(uid).listen(
      (value) {
        if (value == _balance) return;
        final isFirstEmission = !_loadedOnce;
        _balance = value;
        notifyListeners();
        // The balance MOVED, so the Rewards total may have moved with it — an
        // admin credit lands on users/{uid} and walletTransactions at the same
        // moment. The balance has a live listener; the aggregate sum() does not,
        // and this tab is kept alive by the shell's IndexedStack, so without
        // this the card would climb to ₹1,100 while the tile below it still read
        // the figure from whenever the tab was first opened.
        //
        // Skipped on the first emission: `_loadFirstPage` is already fetching
        // the aggregate at that point, and re-running it would just double the
        // read on every cold open.
        if (!isFirstEmission) unawaited(_refreshBreakdown());
      },
      // A dropped listener must not blank the screen — the ledger below is
      // still valid, so surface the message and keep the last known balance.
      onError: (Object _) {
        _error = 'Could not keep your balance up to date.';
        notifyListeners();
      },
    );

    await _loadFirstPage();
  }

  /// Pull-to-refresh: re-read page 1 and the aggregates. The balance needs no
  /// refresh — it is already live on the subscription.
  Future<void> refresh() => _loadFirstPage();

  Future<void> _loadFirstPage() async {
    if (_uid.isEmpty) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    // Fired together — the ledger page and the two aggregates are independent
    // reads, and awaiting them in sequence would double the time to first paint.
    final pageFuture = _getTransactions(GetWalletTransactionsParams(
      uid: _uid,
      limit: AppDimens.pageSize,
    ));
    final breakdownFuture = _getBreakdown(_uid);

    (await pageFuture).fold(
      (failure) => _error = failure.message,
      (page) {
        _transactions = page.items;
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
      },
    );

    // A failed aggregate must not blank the history: keep the previous totals
    // and let the ledger render.
    (await breakdownFuture).fold(
      (_) {},
      (value) => _breakdown = value,
    );

    _isLoading = false;
    _loadedOnce = true;
    notifyListeners();
  }

  /// Re-run the Rewards aggregate on its own, without touching the ledger page.
  /// Silent on failure — the tile keeps its last good figure rather than
  /// flashing ₹0 because one aggregate call timed out.
  Future<void> _refreshBreakdown() async {
    if (_uid.isEmpty) return;
    final result = await _getBreakdown(_uid);
    result.fold((_) {}, (value) {
      if (value == _breakdown) return;
      _breakdown = value;
      notifyListeners();
    });
  }

  /// Append the next cursor page. No-op while a page is already in flight or
  /// when the ledger is exhausted.
  Future<void> loadMore() async {
    if (_isLoadingMore || !_hasMore || _uid.isEmpty || _cursor == null) return;
    _isLoadingMore = true;
    _error = null;
    notifyListeners();

    final result = await _getTransactions(GetWalletTransactionsParams(
      uid: _uid,
      startAfter: _cursor,
      limit: AppDimens.pageSize,
    ));

    result.fold(
      (failure) => _error = failure.message,
      (page) {
        _transactions = [..._transactions, ...page.items];
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
      },
    );

    _isLoadingMore = false;
    notifyListeners();
  }

  /// Add money to the wallet. Returns true only when the server credited it.
  ///
  /// Step 1 of "Add money": ask the server to open a Razorpay order.
  ///
  /// Returns what the Razorpay sheet needs, or `null` on failure (with [error]
  /// set). The PAGE opens the sheet, not this provider — `razorpay_flutter` is a
  /// plugin with its own success/error/external-wallet callbacks and a
  /// `clear()` that must run in `dispose`, and a ChangeNotifier is the wrong
  /// place to own a native lifecycle.
  ///
  /// Nothing is credited by this call. `_isToppingUp` stays true across the
  /// whole journey — the sheet is modal and the button must not be re-armable
  /// behind it — and is cleared by [finishTopUp].
  Future<WalletTopUpOrder?> startTopUp(double amount) async {
    if (amount <= 0) {
      _error = 'Enter an amount greater than ₹0.';
      notifyListeners();
      return null;
    }

    _isToppingUp = true;
    _error = null;
    notifyListeners();

    final result = await _createTopUpOrder(amount);
    return result.fold(
      (failure) {
        _error = failure.message;
        _isToppingUp = false;
        notifyListeners();
        return null;
      },
      (order) => order,
    );
  }

  /// Step 2: hand Razorpay's result to the server, which verifies the signature
  /// and credits the wallet.
  ///
  /// Deliberately does NOT touch [_balance]. `watchBalance` is streaming
  /// `users/{uid}`, so the credit arrives on its own the moment the function
  /// commits; adding an optimistic bump here would mean two writers for one
  /// number and a visible correction when they disagree.
  /// Resolves to the credited amount in rupees, or `null` if nothing was
  /// credited. The amount is the SERVER's — this device may not know it any
  /// more, because Razorpay's Activity can outlive the page that started the
  /// top-up.
  Future<double?> finishTopUp({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final result = await _verifyTopUp(
      VerifyWalletTopUpParams(
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
      ),
    );

    _isToppingUp = false;
    return result.fold(
      (failure) {
        _error = failure.message;
        notifyListeners();
        return null;
      },
      (amount) {
        if (amount == null) {
          // The gateway would not vouch for this payment. Money may still have
          // moved at Razorpay's end, so point the customer at support rather
          // than implying nothing happened.
          _error =
              'We could not confirm that payment. If money left your account it '
              'will be returned, or contact support with your payment id.';
        }
        notifyListeners();
        return amount;
      },
    );
  }

  /// The customer dismissed the Razorpay sheet, or it failed. Re-arms the button
  /// without inventing an error message for a deliberate cancel.
  void cancelTopUp([String? message]) {
    _isToppingUp = false;
    _error = message;
    notifyListeners();
  }

  /// Clear the error banner once it has been shown as a toast.
  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    // Without this the listener outlives the provider and keeps a Firestore
    // snapshot open (and calls notifyListeners on a disposed notifier).
    _balanceSub?.cancel();
    _balanceSub = null;
    super.dispose();
  }
}
