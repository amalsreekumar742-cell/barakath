import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/login_prompt_sheet.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../cart/presentation/providers/cart_provider.dart';

/// Root scaffold hosting the 5-tab bottom navigation (spec §2.5:
/// Home, Category, Bag, Wallet, Profile; the active tab's icon changes color).
///
/// Uses go_router's [StatefulShellRoute.indexedStack] pattern: the router wires
/// five branches (/home, /categories, /bag, /wallet, /profile) and passes the
/// [navigationShell] here. [navigationShell] is rendered as the body (an
/// IndexedStack that preserves each branch's state), and the bottom bar drives
/// [StatefulNavigationShell.goBranch].
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  /// Guest = auth known and unauthenticated. Guarded defensively because
  /// [AuthProvider] is registered centrally in main.dart; if it is not yet in
  /// the tree we treat the user as "not a guest" so navigation never breaks.
  bool _isGuest(BuildContext context) {
    try {
      final auth = context.read<AuthProvider>();
      return auth.isGuest && !auth.isAuthenticated;
    } catch (_) {
      return false;
    }
  }

  void _onTap(BuildContext context, int index) {
    // Guest guard (spec §2.4): Wallet (3) and Profile (4) require login. A guest
    // tapping them does NOT switch tabs — we prompt to log in instead.
    if ((index == 3 || index == 4) && _isGuest(context)) {
      showLoginPromptSheet(context);
      return;
    }
    navigationShell.goBranch(
      index,
      // Tapping the already-active tab returns it to its initial location.
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = navigationShell.currentIndex;
    final cartCount = context.watch<CartProvider>().itemCount;

    return Scaffold(
      body: navigationShell,
      // Figma node 82:4534 — white bar with a hairline top edge, gold-strong
      // active tab and 11px labels.
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.hairline)),
          boxShadow: [
            BoxShadow(
              color: Color(0x0D5F4A2E),
              blurRadius: 8,
              offset: Offset(0, -6),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) => _onTap(context, index),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: AppColors.goldStrong,
          unselectedItemColor: AppColors.textFaint,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          selectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            letterSpacing: 0.11,
          ),
          unselectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w500,
            letterSpacing: 0.11,
          ),
          items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_outlined),
            activeIcon: Icon(Icons.grid_view),
            label: 'Category',
          ),
          BottomNavigationBarItem(
            icon: _BagIcon(count: cartCount, active: false),
            activeIcon: _BagIcon(count: cartCount, active: true),
            label: 'Bag',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.account_balance_wallet_outlined),
            activeIcon: Icon(Icons.account_balance_wallet),
            label: 'Wallet',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
          ],
        ),
      ),
    );
  }
}

/// The Bag tab icon with a red count badge (shown only when the cart is
/// non-empty), reflecting `CartProvider.itemCount`.
class _BagIcon extends StatelessWidget {
  const _BagIcon({required this.count, required this.active});

  final int count;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final icon = Icon(active ? Icons.shopping_bag : Icons.shopping_bag_outlined);
    if (count <= 0) return icon;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        icon,
        Positioned(
          top: -6,
          right: -8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
            constraints: const BoxConstraints(minWidth: 18),
            decoration: BoxDecoration(
              color: AppColors.danger,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.surface, width: 1.5),
            ),
            child: Text(
              count > 99 ? '99+' : '$count',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                height: 1.2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
