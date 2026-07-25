import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';

/// The screen's initial (pre-query) content: recent search history followed by
/// trending terms. Purely presentational — every action is a callback, so the
/// page owns the provider and the text field.
///
/// Both lists render as pill chips per the Figma search screen (node 46:5617).
/// Removing a single recent term moved from a row-level ✕ to a long-press,
/// because the design's chip has no room for one.
class SearchSuggestionsView extends StatelessWidget {
  const SearchSuggestionsView({
    super.key,
    required this.recentSearches,
    required this.trendingSearches,
    required this.onTermTap,
    required this.onRemoveRecent,
    required this.onClearAll,
  });

  final List<String> recentSearches;
  final List<String> trendingSearches;
  final ValueChanged<String> onTermTap;
  final ValueChanged<String> onRemoveRecent;
  final VoidCallback onClearAll;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 24),
      children: [
        if (recentSearches.isNotEmpty) ...[
          _SectionLabel(
            title: 'Recent',
            actionLabel: 'Clear all',
            onAction: onClearAll,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 9,
            runSpacing: 9,
            children: recentSearches
                .map(
                  (term) => _TermChip(
                    label: term,
                    onTap: () => onTermTap(term),
                    onLongPress: () => onRemoveRecent(term),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 18),
        ],
        if (trendingSearches.isNotEmpty) ...[
          const _SectionLabel(title: 'Trending'),
          const SizedBox(height: 10),
          Wrap(
            spacing: 9,
            runSpacing: 9,
            children: trendingSearches
                .map(
                  (term) => _TermChip(
                    label: term,
                    icon: Icons.trending_up_rounded,
                    onTap: () => onTermTap(term),
                  ),
                )
                .toList(),
          ),
        ],
      ],
    );
  }
}

/// The small uppercase section caption (Figma node 46:5616).
class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            color: AppColors.textFaint,
          ),
        ),
        const Spacer(),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
              child: Text(
                actionLabel!,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brandGreen,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// A search-term pill (Figma node 46:5618).
class _TermChip extends StatelessWidget {
  const _TermChip({
    required this.label,
    required this.onTap,
    this.onLongPress,
    this.icon,
  });

  final String label;
  final VoidCallback onTap;
  final VoidCallback? onLongPress;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      onLongPress: onLongPress,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 19, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.hairline),
          borderRadius: BorderRadius.circular(9999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 15, color: AppColors.goldStrong),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                height: 1.5,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
