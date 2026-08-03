import 'package:equatable/equatable.dart';

/// One selectable value on a variant axis — a colour, or a size/unit.
///
/// WHY this exists rather than passing `List<Variant>` to the selector: a product's variants are
/// (colour, size) PAIRS, but the shopper picks one axis at a time. Flattening each axis into its own
/// option list keeps the widget dumb — it renders chips and reports taps — while the provider owns
/// the rule for which variant a given tap resolves to.
class VariantOption extends Equatable {
  const VariantOption({
    required this.value,
    required this.colorCode,
    required this.soldOut,
  });

  /// The colour name ("Gold") or size label ("30ml"). Also the selection key.
  final String value;

  /// `#RRGGBB` swatch for a colour option; empty on a size option.
  final String colorCode;

  /// True when EVERY variant carrying this value is out of stock.
  ///
  /// Deliberately an availability signal for the value itself, not for the pair the tap would land
  /// on: a colour that is sold out in the currently selected size but stocked in another must not be
  /// greyed out, or the shopper is told the colour is gone when it is one tap away.
  final bool soldOut;

  @override
  List<Object?> get props => [value, colorCode, soldOut];
}
