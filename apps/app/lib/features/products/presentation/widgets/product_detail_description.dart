import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// Product description, collapsed to 3 lines with a Read more / Read less
/// toggle. The toggle only appears when the text actually overflows, measured
/// against the real constraints rather than guessed from a character count.
class ProductDetailDescription extends StatefulWidget {
  const ProductDetailDescription({super.key, required this.description});

  final String description;

  @override
  State<ProductDetailDescription> createState() =>
      _ProductDetailDescriptionState();
}

class _ProductDetailDescriptionState extends State<ProductDetailDescription> {
  static const int _collapsedLines = 3;
  static const TextStyle _bodyStyle = TextStyle(
    color: AppColors.textSecondary,
    fontSize: 13.5,
    height: 1.55,
  );

  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    if (widget.description.trim().isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppDimens.screenPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Description',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, constraints) {
              final painter = TextPainter(
                text: TextSpan(text: widget.description, style: _bodyStyle),
                maxLines: _collapsedLines,
                textDirection: Directionality.of(context),
              )..layout(maxWidth: constraints.maxWidth);
              final overflows = painter.didExceedMaxLines;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.description,
                    maxLines: _expanded ? null : _collapsedLines,
                    overflow: _expanded
                        ? TextOverflow.visible
                        : TextOverflow.ellipsis,
                    style: _bodyStyle,
                  ),
                  if (overflows)
                    GestureDetector(
                      onTap: () => setState(() => _expanded = !_expanded),
                      child: Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          _expanded ? 'Read less' : 'Read more',
                          style: const TextStyle(
                            color: AppColors.brandGreen,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
