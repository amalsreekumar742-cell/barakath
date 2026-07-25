import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';
import '../../../categories/domain/entities/category.dart';

/// "Shop by category" — a horizontal row of circular category tiles.
///
/// The row scrolls instead of wrapping so the section keeps a fixed height no
/// matter how many categories the admin has; the full set lives behind
/// "View All" on the Categories tab.
class CategoryStrip extends StatelessWidget {
  const CategoryStrip({
    super.key,
    required this.categories,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
  });

  final List<Category> categories;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 16),
        itemBuilder: (_, index) => _CategoryTile(category: categories[index]),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.category});

  final Category category;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      // The listing needs the name too: it's the screen title, and re-reading
      // the category doc just to render a heading would be a wasted round-trip.
      onTap: () => context.push(
        '/product-listing?categoryId=${Uri.encodeComponent(category.id)}'
        '&categoryName=${Uri.encodeComponent(category.name)}',
      ),
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 64,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipOval(
              child: CachedImage(
                url: category.image,
                width: 60,
                height: 60,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              category.name,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                height: 1.25,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
