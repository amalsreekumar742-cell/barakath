import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/widgets/paginated_list_view.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../../checkout/domain/entities/coupon.dart';
import '../providers/spinner_provider.dart';
import '../widgets/coupon_wallet_card.dart';

/// The coupon wallet at `/my-coupons` (spec §2.23 "My coupons").
///
/// READ-ONLY, and deliberately a different screen from `/coupons`: that one is
/// the checkout Apply-Coupon picker, which validates and applies. This one only
/// shows what the customer has won. Both read the same `coupons` documents, so
/// the validation rules live in exactly one place — CouponProvider — and are
/// not restated here.
class MyCouponsPage extends StatefulWidget {
  const MyCouponsPage({super.key});

  @override
  State<MyCouponsPage> createState() => _MyCouponsPageState();
}

class _MyCouponsPageState extends State<MyCouponsPage> {
  static const List<SpinRewardStatus> _tabs = [
    SpinRewardStatus.active,
    SpinRewardStatus.used,
    SpinRewardStatus.expired,
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SpinnerProvider>().loadCoupons();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SpinnerProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('My coupons')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppDimens.screenPadding,
              AppDimens.space8,
              AppDimens.screenPadding,
              AppDimens.space12,
            ),
            child: Row(
              children: [
                for (final tab in _tabs) ...[
                  _TabChip(
                    label: tab.label,
                    selected: provider.couponTab == tab,
                    onTap: () => provider.setCouponTab(tab),
                  ),
                  if (tab != _tabs.last) const SizedBox(width: AppDimens.space8),
                ],
              ],
            ),
          ),
          Expanded(
            child: PaginatedListView<Coupon>(
              items: provider.coupons,
              isLoading: provider.couponsLoading,
              isLoadingMore: provider.couponsLoadingMore,
              hasMore: provider.couponsHasMore,
              onLoadMore: provider.loadMoreCoupons,
              error: provider.couponsError,
              onRetry: provider.loadCoupons,
              onRefresh: provider.loadCoupons,
              emptyIcon: Icons.confirmation_number_outlined,
              emptyTitle: _emptyTitle(provider.couponTab),
              emptySubtitle: _emptySubtitle(provider.couponTab),
              skeleton: const ShimmerCard(height: 56),
              skeletonCount: 4,
              itemBuilder: (_, coupon, __) => CouponWalletCard(
                coupon: coupon,
                status: provider.couponTab,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // Message only, no action button (spec §2.25).
  String _emptyTitle(SpinRewardStatus tab) => switch (tab) {
        SpinRewardStatus.active => 'No active coupons',
        SpinRewardStatus.used => 'No used coupons',
        SpinRewardStatus.expired => 'No expired coupons',
      };

  String _emptySubtitle(SpinRewardStatus tab) => switch (tab) {
        SpinRewardStatus.active =>
          'Coupons you win on the spin wheel show up here.',
        SpinRewardStatus.used => 'Coupons you have already applied land here.',
        SpinRewardStatus.expired =>
          'Coupons that ran out of time land here.',
      };
}

/// Filter chip: brand-green fill when selected, hairline outline when not.
class _TabChip extends StatelessWidget {
  const _TabChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimens.radiusPill),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
        decoration: BoxDecoration(
          color: selected ? AppColors.brandGreen : AppColors.surface,
          borderRadius: BorderRadius.circular(AppDimens.radiusPill),
          border: Border.all(
            color: selected ? AppColors.brandGreen : AppColors.hairline,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}
