import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../../core/widgets/price_display.dart';
import '../../domain/repositories/product_detail_repository.dart';

/// "Frequently bought together" (design frame `Product · Bundle`).
///
/// One bordered card holding a row per product — the one being viewed first,
/// marked "This product", then each bundle partner — every row tickable, with a
/// single CTA that adds everything ticked. This replaced a horizontal strip of
/// 120px tiles, which was neither the design nor readable: prices landed at
/// different heights depending on how many lines each name wrapped to, and the
/// strip gave no way to act on the bundle it was advertising.
class ProductDetailBundleSection extends StatefulWidget {
  const ProductDetailBundleSection({
    super.key,
    required this.currentItem,
    required this.items,
    required this.comboDeliveryCharge,
    required this.onItemTap,
    required this.onAddSelected,
  });

  /// The product being viewed — the first row, always shown as "This product".
  final BundleItem currentItem;

  /// The bundle partners, in the merchant's authored order.
  final List<BundleItem> items;

  /// Shown under the rows when non-zero. Not in the design frame, but it is
  /// merchant-configured data the shopper is about to be charged, so it stays —
  /// as a quiet line inside the card rather than a banner shouting "₹0".
  final double comboDeliveryCharge;

  final ValueChanged<String> onItemTap;

  /// Fires with every ticked row when the CTA is pressed.
  final ValueChanged<List<BundleItem>> onAddSelected;

  @override
  State<ProductDetailBundleSection> createState() =>
      _ProductDetailBundleSectionState();
}

class _ProductDetailBundleSectionState
    extends State<ProductDetailBundleSection> {
  /// The ids the shopper has UNticked — everything starts ticked, since the
  /// section exists to sell the set.
  ///
  /// WHY the inverse of a "selected" set: `ProductDetailProvider.bundleItems`
  /// returns `List.unmodifiable(...)`, a fresh instance on every read, so a
  /// selected-set would have to be reconciled against a list whose identity
  /// changes each build. Storing the exceptions needs no reconciliation: a row
  /// that disappears takes its state with it, and a row that appears is ticked.
  final Set<String> _unticked = {};

  List<BundleItem> get _rows => [widget.currentItem, ...widget.items];

  bool _isTicked(String productId) => !_unticked.contains(productId);

  List<BundleItem> get _tickedItems =>
      _rows.where((item) => _isTicked(item.product.id)).toList();

  void _toggle(String productId) {
    setState(() {
      if (!_unticked.remove(productId)) _unticked.add(productId);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    final rows = _rows;
    final ticked = _tickedItems;
    final count = ticked.length;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Frequently bought together',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppDimens.radiusXl),
              border: Border.all(color: AppColors.hairline),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppDimens.radiusXl),
              child: Column(
                children: [
                  for (var i = 0; i < rows.length; i++)
                    _BundleRow(
                      item: rows[i],
                      isCurrentProduct: i == 0,
                      isSelected: _isTicked(rows[i].product.id),
                      // The row being viewed opens nothing — the shopper is
                      // already on it.
                      onTap: i == 0
                          ? null
                          : () => widget.onItemTap(rows[i].product.id),
                      onToggle: () => _toggle(rows[i].product.id),
                      showDivider: i != 0,
                    ),
                  if (widget.comboDeliveryCharge > 0)
                    _DeliveryChargeLine(amount: widget.comboDeliveryCharge),
                  _AddSelectedButton(
                    count: count,
                    onPressed:
                        count == 0 ? null : () => widget.onAddSelected(ticked),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One product row: thumbnail, name, price, tick box.
class _BundleRow extends StatelessWidget {
  const _BundleRow({
    required this.item,
    required this.isCurrentProduct,
    required this.isSelected,
    required this.onTap,
    required this.onToggle,
    required this.showDivider,
  });

  final BundleItem item;
  final bool isCurrentProduct;
  final bool isSelected;
  final VoidCallback? onTap;
  final VoidCallback onToggle;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final variant = item.variant;
    final price = variant?.effectivePrice;
    final mrp = variant?.mrp;

    return DecoratedBox(
      decoration: BoxDecoration(
        border: showDivider
            ? const Border(top: BorderSide(color: AppColors.hairline))
            : null,
      ),
      // Material, not a coloured DecoratedBox: an InkWell splashes onto the
      // nearest Material, so a colour painted above it would swallow the
      // ripple. The current product sits on the app background so it reads as
      // the anchor of the set rather than another suggestion.
      child: Material(
        color: isCurrentProduct ? AppColors.background : AppColors.surface,
        child: InkWell(
          onTap: onTap ?? onToggle,
          child: Padding(
            padding: const EdgeInsets.all(AppDimens.cardPadding),
            child: Row(
              children: [
                CachedImage(
                  url: item.product.thumbnail,
                  height: 64,
                  width: 64,
                  borderRadius: AppDimens.radiusMd,
                ),
                const SizedBox(width: AppDimens.space12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _NameLine(
                        name: item.product.name,
                        isCurrentProduct: isCurrentProduct,
                      ),
                      const SizedBox(height: 3),
                      if (price == null)
                        const Text(
                          'Unavailable',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textFaint,
                          ),
                        )
                      else
                        PriceDisplay(
                          price: price,
                          originalPrice: mrp,
                          fontSize: 15,
                          showDiscountBadge: false,
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: AppDimens.space12),
                // Its own tap target, so tapping the row opens the product
                // while tapping the box only ticks it.
                GestureDetector(
                  onTap: onToggle,
                  behavior: HitTestBehavior.opaque,
                  child: _TickBox(isSelected: isSelected),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The product name, with the viewed product suffixed "· This product".
class _NameLine extends StatelessWidget {
  const _NameLine({required this.name, required this.isCurrentProduct});

  final String name;
  final bool isCurrentProduct;

  @override
  Widget build(BuildContext context) {
    const base = TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: AppColors.textPrimary,
      height: 1.25,
    );

    if (!isCurrentProduct) {
      return Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: base);
    }

    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: name,
            style: base.copyWith(
              fontWeight: FontWeight.w400,
              color: AppColors.textSecondary,
            ),
          ),
          const TextSpan(text: ' · '),
          const TextSpan(
            text: 'This product',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: base,
    );
  }
}

class _TickBox extends StatelessWidget {
  const _TickBox({required this.isSelected});

  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 26,
      height: 26,
      decoration: BoxDecoration(
        color: isSelected ? AppColors.brandGreen : AppColors.surface,
        borderRadius: BorderRadius.circular(AppDimens.radiusSm),
        border: isSelected
            ? null
            : Border.all(color: AppColors.border, width: 1.5),
      ),
      child: isSelected
          ? const Icon(Icons.check_rounded, size: 16, color: Colors.white)
          : null,
    );
  }
}

class _DeliveryChargeLine extends StatelessWidget {
  const _DeliveryChargeLine({required this.amount});

  final double amount;

  static final NumberFormat _currency = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.hairline)),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppDimens.cardPadding,
        AppDimens.space10,
        AppDimens.cardPadding,
        0,
      ),
      child: Row(
        children: [
          const Icon(
            Icons.local_shipping_outlined,
            size: 16,
            color: AppColors.textSecondary,
          ),
          const SizedBox(width: AppDimens.space8),
          Expanded(
            child: Text(
              'Bundle delivery charge ${_currency.format(amount)}',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddSelectedButton extends StatelessWidget {
  const _AddSelectedButton({required this.count, required this.onPressed});

  final int count;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AppDimens.cardPadding,
        AppDimens.space12,
        AppDimens.cardPadding,
        AppDimens.space14,
      ),
      child: SizedBox(
        height: 44,
        child: ElevatedButton(
          onPressed: onPressed,
          child: Text(
            count == 0
                ? 'Select items to add'
                : 'Add $count ${count == 1 ? 'item' : 'items'} to cart',
          ),
        ),
      ),
    );
  }
}
