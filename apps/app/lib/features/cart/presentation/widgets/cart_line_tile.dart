import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../products/domain/entities/variant.dart';
import '../../domain/entities/cart_item.dart';

/// One line in the bag: image, name, variant, live price and quantity stepper.
class CartLineTile extends StatelessWidget {
  const CartLineTile({
    super.key,
    required this.item,
    required this.variant,
    required this.onIncrement,
    required this.onDecrement,
    required this.onDelete,
  });

  final CartItem item;

  /// Null while the live read is still in flight — the row renders without a
  /// price rather than showing the stale one it was added at.
  final Variant? variant;

  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onDelete;

  double? get _unitPrice => variant?.effectivePrice;

  @override
  Widget build(BuildContext context) {
    final image = (variant?.images.isNotEmpty ?? false)
        ? variant!.images.first
        : item.productImage;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CachedImage(url: image, width: 72, height: 72, borderRadius: 10),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.productName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: onDelete,
                      behavior: HitTestBehavior.opaque,
                      child: const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: Icon(Icons.close_rounded,
                            size: 18, color: AppColors.textFaint),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                _VariantLabel(item: item, variant: variant),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Bordered pill around the stepper, per the design.
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(9999),
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _StepperButton(
                            icon: Icons.remove_rounded,
                            // Below 1 the line should be removed explicitly,
                            // not silently vanish under a stepper tap.
                            onTap: item.quantity > 1 ? onDecrement : null,
                          ),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12),
                            child: Text(
                              '${item.quantity}',
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          _StepperButton(
                              icon: Icons.add_rounded, onTap: onIncrement),
                        ],
                      ),
                    ),
                    const Spacer(),
                    if (_unitPrice != null) ...[
                      // The struck MRP rides beside the line total rather than
                      // taking its own row, so the discount survives the
                      // design's tighter layout.
                      if (variant!.mrp > _unitPrice!) ...[
                        Text(
                          '₹${(variant!.mrp * item.quantity).toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.textFaint,
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                        const SizedBox(width: 6),
                      ],
                      Text(
                        '₹${(_unitPrice! * item.quantity).toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.goldStrong,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VariantLabel extends StatelessWidget {
  const _VariantLabel({required this.item, required this.variant});

  final CartItem item;
  final Variant? variant;

  @override
  Widget build(BuildContext context) {
    final name = variant?.name.isNotEmpty == true ? variant!.name : item.variantName;
    final swatch = _swatch(variant?.colorCode ?? '');
    return Row(
      children: [
        if (swatch != null) ...[
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: swatch,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.hairline),
            ),
          ),
          const SizedBox(width: 6),
        ],
        Flexible(
          child: Text(
            name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ),
      ],
    );
  }

  /// Parse `#RRGGBB` / `RRGGBB`; anything else renders no swatch rather than a
  /// misleading black dot.
  Color? _swatch(String hex) {
    var value = hex.trim().replaceAll('#', '');
    if (value.length == 6) value = 'FF$value';
    if (value.length != 8) return null;
    final parsed = int.tryParse(value, radix: 16);
    return parsed == null ? null : Color(parsed);
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: enabled ? AppColors.subtle : AppColors.subtle.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 16,
          color: enabled ? AppColors.textPrimary : AppColors.muted,
        ),
      ),
    );
  }
}
