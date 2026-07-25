import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/utils/constants.dart';
import '../../domain/entities/affiliate_transaction.dart';
import '../../domain/entities/affiliate_withdrawal.dart';
import '../../domain/entities/bank_account.dart';
import '../../domain/entities/ifsc_details.dart';
import '../../domain/repositories/affiliate_repository.dart';
import '../../domain/usecases/affiliate_usecases.dart';

/// Affiliate commission ledger, payout requests, bank accounts and the IFSC
/// lookup (spec §2.22).
///
/// WHY there are no stats here: `affiliateBalance`, `pendingCommission`,
/// `confirmedCommission` and `totalReferrals` all live on `users/{uid}`, which
/// `AuthProvider` already mirrors live. Opening a second `onSnapshot` on the
/// same document would double the reads and let the two views disagree — the
/// affiliate screens read `AuthProvider.currentUser` directly.
///
/// Both lists are cursor-paginated (12/page, "View More"), each with its own
/// loading/cursor state so one section refreshing never blanks the other.
@injectable
class AffiliateProvider extends ChangeNotifier {
  AffiliateProvider(
    this._getCommissions,
    this._getWithdrawals,
    this._getBankAccounts,
    this._addBankAccount,
    this._deleteBankAccount,
    this._createWithdrawal,
    this._verifyIfsc,
  );

  final GetCommissions _getCommissions;
  final GetWithdrawals _getWithdrawals;
  final GetBankAccounts _getBankAccounts;
  final AddBankAccount _addBankAccount;
  final DeleteBankAccount _deleteBankAccount;
  final CreateWithdrawal _createWithdrawal;
  final VerifyIfsc _verifyIfsc;

  /// Spec §2.22 — the store's minimum payout. Sourced from `core/constants`, so
  /// the client-side check and the Firestore rule can never drift apart in code.
  static const double minWithdrawalAmount = AppDetails.minWithdrawalAmount;

  /// Spec §4.16 — currently ₹0. Shown in the summary only; there is no
  /// `processingFee` field on the deployed withdrawal document.
  static const double processingFee = 0;

  /// Spec §2.22 — max 2 saved payout accounts.
  static const int maxBankAccounts = 2;

  // --- Commission ledger ----------------------------------------------------
  List<AffiliateTransaction> _commissions = [];
  bool _isLoadingCommissions = false;
  bool _isLoadingMoreCommissions = false;
  bool _hasMoreCommissions = false;
  Object? _commissionCursor;
  String? _commissionsError;

  List<AffiliateTransaction> get commissions => List.unmodifiable(_commissions);
  bool get isLoadingCommissions => _isLoadingCommissions;
  bool get isLoadingMoreCommissions => _isLoadingMoreCommissions;
  bool get hasMoreCommissions => _hasMoreCommissions;
  String? get commissionsError => _commissionsError;

  // --- Withdrawal requests --------------------------------------------------
  List<AffiliateWithdrawal> _withdrawals = [];
  bool _isLoadingWithdrawals = false;
  bool _isLoadingMoreWithdrawals = false;
  bool _hasMoreWithdrawals = false;
  Object? _withdrawalCursor;
  String? _withdrawalsError;

  List<AffiliateWithdrawal> get withdrawals => List.unmodifiable(_withdrawals);
  bool get isLoadingWithdrawals => _isLoadingWithdrawals;
  bool get isLoadingMoreWithdrawals => _isLoadingMoreWithdrawals;
  bool get hasMoreWithdrawals => _hasMoreWithdrawals;
  String? get withdrawalsError => _withdrawalsError;

  // --- Bank accounts --------------------------------------------------------
  List<BankAccount> _bankAccounts = [];
  bool _isLoadingBankAccounts = false;
  String? _bankAccountsError;

  List<BankAccount> get bankAccounts => List.unmodifiable(_bankAccounts);
  bool get isLoadingBankAccounts => _isLoadingBankAccounts;
  String? get bankAccountsError => _bankAccountsError;
  bool get hasBankAccountSlot => _bankAccounts.length < maxBankAccounts;

  // --- Writes ---------------------------------------------------------------
  bool _isSubmitting = false;
  String? _error;

  bool get isSubmitting => _isSubmitting;
  String? get error => _error;

  // --- IFSC lookup ----------------------------------------------------------
  bool _isVerifyingIfsc = false;
  IfscDetails? _ifscDetails;
  String? _ifscError;

  bool get isVerifyingIfsc => _isVerifyingIfsc;
  IfscDetails? get ifscDetails => _ifscDetails;
  String? get ifscError => _ifscError;

  /// Page size for both ledgers — exposed so a screen never hardcodes 12.
  int get pageSize => PageSizes.defaultPageSize;

  // =========================================================================
  // Commission ledger
  // =========================================================================

  /// First page of the ledger. Resets the cursor, so re-entering the screen
  /// starts clean.
  Future<void> loadCommissions(String uid) async {
    _isLoadingCommissions = true;
    _commissionsError = null;
    _commissionCursor = null;
    notifyListeners();

    final result = await _getCommissions(AffiliatePageParams(uid: uid));
    result.fold(
      (failure) {
        _commissionsError = failure.message;
        _commissions = [];
        _hasMoreCommissions = false;
      },
      (page) => _applyCommissionPage(page, replace: true),
    );

    _isLoadingCommissions = false;
    notifyListeners();
  }

  Future<void> loadMoreCommissions(String uid) async {
    if (_isLoadingMoreCommissions || !_hasMoreCommissions) return;
    _isLoadingMoreCommissions = true;
    notifyListeners();

    final result = await _getCommissions(
      AffiliatePageParams(uid: uid, startAfter: _commissionCursor),
    );
    result.fold(
      (failure) => _commissionsError = failure.message,
      (page) => _applyCommissionPage(page, replace: false),
    );

    _isLoadingMoreCommissions = false;
    notifyListeners();
  }

  void _applyCommissionPage(
    AffiliatePage<AffiliateTransaction> page, {
    required bool replace,
  }) {
    _commissions = replace ? page.items : [..._commissions, ...page.items];
    _commissionCursor = page.nextCursor;
    _hasMoreCommissions = page.hasMore;
    _commissionsError = null;
  }

  // =========================================================================
  // Withdrawal requests
  // =========================================================================

  Future<void> loadWithdrawals(String uid) async {
    _isLoadingWithdrawals = true;
    _withdrawalsError = null;
    _withdrawalCursor = null;
    notifyListeners();

    final result = await _getWithdrawals(AffiliatePageParams(uid: uid));
    result.fold(
      (failure) {
        _withdrawalsError = failure.message;
        _withdrawals = [];
        _hasMoreWithdrawals = false;
      },
      (page) => _applyWithdrawalPage(page, replace: true),
    );

    _isLoadingWithdrawals = false;
    notifyListeners();
  }

  Future<void> loadMoreWithdrawals(String uid) async {
    if (_isLoadingMoreWithdrawals || !_hasMoreWithdrawals) return;
    _isLoadingMoreWithdrawals = true;
    notifyListeners();

    final result = await _getWithdrawals(
      AffiliatePageParams(uid: uid, startAfter: _withdrawalCursor),
    );
    result.fold(
      (failure) => _withdrawalsError = failure.message,
      (page) => _applyWithdrawalPage(page, replace: false),
    );

    _isLoadingMoreWithdrawals = false;
    notifyListeners();
  }

  void _applyWithdrawalPage(
    AffiliatePage<AffiliateWithdrawal> page, {
    required bool replace,
  }) {
    _withdrawals = replace ? page.items : [..._withdrawals, ...page.items];
    _withdrawalCursor = page.nextCursor;
    _hasMoreWithdrawals = page.hasMore;
    _withdrawalsError = null;
  }

  // =========================================================================
  // Bank accounts
  // =========================================================================

  Future<void> loadBankAccounts(String uid) async {
    _isLoadingBankAccounts = true;
    _bankAccountsError = null;
    notifyListeners();

    final result = await _getBankAccounts(uid);
    result.fold(
      (failure) {
        _bankAccountsError = failure.message;
        _bankAccounts = [];
      },
      (accounts) => _bankAccounts = accounts,
    );

    _isLoadingBankAccounts = false;
    notifyListeners();
  }

  /// Saves a payout account. Returns false with [error] set on failure (the
  /// 2-account cap, a duplicate number, or a rejected write).
  Future<bool> addBankAccount({
    required String uid,
    required String accountHolderName,
    required String accountNumber,
    required String ifscCode,
    required String bankName,
    required String bankBranch,
  }) async {
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    final result = await _addBankAccount(
      AddBankAccountParams(
        uid: uid,
        account: BankAccount(
          id: '',
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          bankName: bankName.trim(),
          bankBranch: bankBranch.trim(),
          createdAt: null,
        ),
      ),
    );

    var ok = false;
    result.fold((failure) => _error = failure.message, (_) => ok = true);

    _isSubmitting = false;
    notifyListeners();
    if (ok) await loadBankAccounts(uid);
    return ok;
  }

  Future<bool> deleteBankAccount({
    required String uid,
    required String accountId,
  }) async {
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    final result = await _deleteBankAccount(
      DeleteBankAccountParams(uid: uid, accountId: accountId),
    );

    var ok = false;
    result.fold((failure) => _error = failure.message, (_) => ok = true);

    _isSubmitting = false;
    notifyListeners();
    if (ok) await loadBankAccounts(uid);
    return ok;
  }

  /// True when [accountNumber] is already saved — the add form blocks on this
  /// before it even hits the network.
  bool isAccountNumberSaved(String accountNumber) {
    final trimmed = accountNumber.trim();
    return _bankAccounts.any((a) => a.accountNumber.trim() == trimmed);
  }

  // =========================================================================
  // Withdrawal request
  // =========================================================================

  /// Files a payout request. The app NEVER writes `affiliateBalance` — admin
  /// approves and transfers outside the system (spec §2.22), and the Firestore
  /// rule re-validates [amount] against the server's copy of the balance.
  Future<bool> submitWithdrawal({
    required String uid,
    required String userName,
    required String userPhone,
    required double amount,
    required BankAccount account,
  }) async {
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    final result = await _createWithdrawal(
      AffiliateWithdrawal(
        id: '',
        userId: uid,
        userName: userName,
        userPhone: userPhone,
        amount: amount,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        ifscCode: account.ifscCode,
        accountHolderName: account.accountHolderName,
        status: WithdrawalStatus.pending.label,
        rejectionReason: '',
        processedBy: '',
        processedAt: null,
        createdAt: null,
      ),
    );

    var ok = false;
    result.fold((failure) => _error = failure.message, (_) => ok = true);

    _isSubmitting = false;
    notifyListeners();
    // Show the new Pending row immediately rather than making the customer
    // pull-to-refresh the wallet.
    if (ok) await loadWithdrawals(uid);
    return ok;
  }

  // =========================================================================
  // IFSC lookup
  // =========================================================================

  /// Resolves an IFSC code to its bank + branch. Returns null with [ifscError]
  /// set when the code is invalid or the network is down.
  Future<IfscDetails?> verifyIfsc(String ifsc) async {
    final code = ifsc.trim().toUpperCase();
    _isVerifyingIfsc = true;
    _ifscError = null;
    _ifscDetails = null;
    notifyListeners();

    final result = await _verifyIfsc(code);
    result.fold(
      (failure) => _ifscError = failure.message,
      (details) => _ifscDetails = details,
    );

    _isVerifyingIfsc = false;
    notifyListeners();
    return _ifscDetails;
  }

  /// Drops a resolved bank the moment the IFSC field changes, so a stale bank
  /// name can never be saved against a newly typed code.
  void clearIfsc() {
    if (_ifscDetails == null && _ifscError == null && !_isVerifyingIfsc) return;
    _ifscDetails = null;
    _ifscError = null;
    _isVerifyingIfsc = false;
    notifyListeners();
  }

  void clearError() {
    if (_error == null) return;
    _error = null;
    notifyListeners();
  }
}
