import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/login_prompt_sheet.dart';
import '../../../../core/widgets/paginated_list_view.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../settings/presentation/providers/general_settings_provider.dart';
import '../../domain/entities/wallet_top_up_support.dart';
import '../../domain/entities/wallet_transaction.dart';
import '../providers/wallet_provider.dart';
import '../widgets/wallet_balance_card.dart';
import '../widgets/wallet_breakdown_tiles.dart';
import '../widgets/wallet_transaction_tile.dart';

/// Wallet tab — the customer's Normal Wallet (spec §2.20, frame
/// `26 · Normal Wallet`).
///
/// Read-only: the balance streams off `users/{uid}.walletBalance` and the ledger
/// pages `walletTransactions` filtered by `userId`. Nothing here writes money.
///
/// Spec §2.4 gates the tab behind login; a guest sees the login prompt.
class WalletPage extends StatefulWidget {
  const WalletPage({super.key});

  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  /// The uid the provider was last initialised for — re-init only when the
  /// signed-in customer actually changes, not on every rebuild.
  String? _initialisedUid;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncUser());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncUser();
  }

  void _syncUser() {
    if (!mounted) return;
    final uid = _uid;
    if (uid.isEmpty || uid == _initialisedUid) return;
    _initialisedUid = uid;
    context.read<WalletProvider>().init(uid);
  }

  String get _uid {
    try {
      return context.read<AuthProvider>().currentUser?.id ?? '';
    } catch (_) {
      return '';
    }
  }

  bool _isGuest(BuildContext context) {
    try {
      final auth = context.read<AuthProvider>();
      return auth.isGuest && !auth.isAuthenticated;
    } catch (_) {
      return false;
    }
  }

  /// Wallet payments are switched off store-wide from `general/config`
  /// (`payment.walletPaymentsEnabled`). When false the wallet is read-only:
  /// history stays visible, but nothing can be added.
  bool _walletPaymentsEnabled(BuildContext context) {
    try {
      return context.watch<GeneralSettingsProvider>().settings
          .walletPaymentsEnabled;
    } catch (_) {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isGuest(context)) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: _appBar(),
        body: EmptyState(
          icon: Icons.account_balance_wallet_outlined,
          title: 'Login to view your wallet',
          subtitle: 'Sign in to see your balance and transactions.',
          actionLabel: 'Login',
          onAction: () => showLoginPromptSheet(context),
        ),
      );
    }

    final wallet = context.watch<WalletProvider>();
    final paymentsEnabled = _walletPaymentsEnabled(context);
    final canTopUp = paymentsEnabled && WalletTopUpSupport.isAvailable;

    // A failure with transactions already on screen is a failed REFRESH — toast
    // it and move on, so the ledger the customer is reading stays put. A failure
    // with nothing loaded is a failed FIRST read: that one goes to the list body
    // as a retryable error state. Toasting it left the page apparently blank
    // with the only explanation already fading away.
    final error = wallet.error;
    if (error != null && wallet.transactions.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AppToast.error(context, error);
        context.read<WalletProvider>().clearError();
      });
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: _appBar(),
      body: PaginatedListView<WalletTransaction>(
        items: wallet.transactions,
        isLoading: wallet.isLoading,
        isLoadingMore: wallet.isLoadingMore,
        hasMore: wallet.hasMore,
        onLoadMore: wallet.loadMore,
        onRefresh: wallet.refresh,
        error: wallet.transactions.isEmpty ? wallet.error : null,
        onRetry: wallet.refresh,
        skeleton: const WalletTransactionSkeleton(),
        skeletonCount: 6,
        emptyIcon: Icons.receipt_long_outlined,
        emptyTitle: 'No transactions yet',
        // Spec §2.25: empty states are message only, no action button.
        emptySubtitle:
            'Rewards, refunds and order payments will show up here.',
        separator: const SizedBox(height: AppDimens.space16),
        header: _Header(
          balance: wallet.balance,
          rewardsTotal: wallet.rewardsTotal,
          canTopUp: canTopUp,
          disabledReason: !paymentsEnabled
              ? 'Wallet payments are currently switched off by the store. Your '
                  'balance is safe and never expires.'
              : WalletTopUpSupport.unavailableMessage,
          onAddMoney: () => context.push('/wallet/add-money'),
        ),
        itemBuilder: (_, item, __) => WalletTransactionTile(transaction: item),
      ),
    );
  }

  PreferredSizeWidget _appBar() => AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        titleSpacing: AppDimens.screenPadding,
        title: const Text(
          'Wallet',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.48,
            color: AppColors.textPrimary,
          ),
        ),
      );
}

/// Everything above the ledger: balance card, "Add money", the Rewards tile and
/// the section heading. Scrolls with the list so pull-to-refresh works anywhere
/// on the screen.
class _Header extends StatelessWidget {
  const _Header({
    required this.balance,
    required this.rewardsTotal,
    required this.canTopUp,
    required this.disabledReason,
    required this.onAddMoney,
  });

  final double balance;
  final double rewardsTotal;
  final bool canTopUp;
  final String disabledReason;
  final VoidCallback onAddMoney;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        WalletBalanceCard(balance: balance),
        const SizedBox(height: AppDimens.space16),
        CustomButton(
          label: 'Add money',
          isDisabled: !canTopUp,
          onPressed: canTopUp ? onAddMoney : null,
        ),
        if (!canTopUp) ...[
          const SizedBox(height: AppDimens.space8),
          Text(
            disabledReason,
            style: const TextStyle(
              fontSize: 12,
              height: 1.4,
              color: AppColors.textSecondary,
            ),
          ),
        ],
        const SizedBox(height: AppDimens.space16),
        WalletBreakdownTiles(rewardsTotal: rewardsTotal),
        const SizedBox(height: AppDimens.gapSections),
        const Text(
          'Transaction history',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: AppDimens.space16),
      ],
    );
  }
}
