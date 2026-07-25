import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../domain/repositories/product_detail_repository.dart';

/// "Frequently bought together" strip, shown only for combo products.
///
/// Uses its own compact tile (not the shared `ProductCard`) because the strip
/// needs a 120px-wide thumbnail-first tile, not the full catalogue card.
class ProductDetailBundleSection extends StatelessWidget {
  const ProductDetailBundleSection({
    super.key,
    required this.items,
    required this.comboDeliveryCharge,
    required this.onItemTap,
  });

  final List<BundleItem> items;
  final double comboDeliveryCharge;
  final ValueChanged<String> onItemTap;

  static final NumberFormat _currency = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'Frequently bought together',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) => _BundleTile(
              item: items[i],
              onTap: () => onItemTap(items[i].product.id),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.brandGreenSubtle,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.local_shipping_outlined,
                  size: 18,
                  color: AppColors.brandGreen,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Bundle delivery charge: '
                    '${_currency.format(comboDeliveryCharge)}',
                    style: const TextStyle(
                      color: AppColors.brandGreenDark,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _BundleTile extends StatelessWidget {
  const _BundleTile({required this.item, required this.onTap});

  final BundleItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final variant = item.variant;
    final price = variant?.flashSalePrice ?? variant?.offerPrice;

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: SizedBox(
        width: 120,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CachedImage(
              url: item.product.thumbnail,
              height: 120,
              width: 120,
              borderRadius: 14,
            ),
            const SizedBox(height: 8),
            Text(
              item.product.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 4),
            if (price != null)
              Text(
                ProductDetailBundleSection._currency.format(price),
                style: const TextStyle(
                  color: AppColors.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
