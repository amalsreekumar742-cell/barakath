import 'package:equatable/equatable.dart';

import 'variant.dart';

/// Multi-axis variants (Colour × Size × Layer …) — how a variant is labelled
/// and which variant a chip selection points at.
///
/// This MIRRORS `packages/shared/src/utils/variantOptions.ts`, which the
/// website uses: a shopper tapping the same chips must land on the same
/// variant on both surfaces, so change the two together.
///
/// Axes are keyed by name: [colourAxis] for the colour, and each option's
/// `group` for the rest. A legacy variant (no `options`) has exactly one
/// non-colour axis, [legacyAxis], whose value is its `name`.

/// Selection key of the colour axis.
const String colourAxis = 'Colour';

/// The axis a single-axis variant's `name` belongs to.
const String legacyAxis = 'Size';

/// One axis value of a variant — a unit from a Settings › Variables group,
/// e.g. `Size 57` or `Layer 2`.
class VariantOption extends Equatable {
  final String group;
  final String value;

  const VariantOption({required this.group, required this.value});

  @override
  List<Object?> get props => [group, value];
}

/// A chip row: an axis and its distinct values, in first-seen order.
class VariantAxis extends Equatable {
  final String axis;
  final List<String> values;

  const VariantAxis({required this.axis, required this.values});

  @override
  List<Object?> get props => [axis, values];
}

/// The canonical form of a group name — trimmed, each word capitalised
/// ("size" → "Size", "LAYER" → "Layer"). Settings group names are typed
/// freely and copied onto each variant, while legacy variants are filed under
/// [legacyAxis]; without one form a product mixing old and new rows would show
/// two size rows. Mirrors `axisLabel` in variantOptions.ts.
String axisLabel(String group) => group
    .trim()
    .toLowerCase()
    .replaceAllMapped(
      RegExp(r'(^|\s)\S'),
      (m) => m.group(0)!.toUpperCase(),
    );

/// The non-colour axes of one variant, in order, with canonical group names
/// ([axisLabel]). A legacy variant's `name` is its single "Size" axis.
List<VariantOption> variantAxes(Variant v) => v.options.isNotEmpty
    ? [
        for (final o in v.options)
          VariantOption(group: axisLabel(o.group), value: o.value),
      ]
    : [VariantOption(group: legacyAxis, value: v.name)];

/// Every axis value of a variant, colour included, keyed by axis name.
Map<String, String> axisValues(Variant v) => {
      colourAxis: v.color,
      for (final o in variantAxes(v)) o.group: o.value,
    };

/// The non-colour chip rows for a product, each axis and value in first-seen
/// order across [variants] (pass them in `sortOrder`, so the admin's order
/// drives the chips).
List<VariantAxis> variantAxisList(List<Variant> variants) {
  final rows = <String, List<String>>{};
  for (final v in variants) {
    for (final o in variantAxes(v)) {
      final values = rows.putIfAbsent(o.group, () => <String>[]);
      if (!values.contains(o.value)) values.add(o.value);
    }
  }
  return [
    for (final e in rows.entries) VariantAxis(axis: e.key, values: e.value),
  ];
}

int _matchCount(
  Map<String, String> values,
  Map<String, String> selection, {
  String? skip,
}) {
  var n = 0;
  selection.forEach((axis, value) {
    if (axis != skip && (values[axis] ?? '') == value) n++;
  });
  return n;
}

/// The variant the current chip selection points at.
///
/// 1. Exact match on every selected axis.
/// 2. Otherwise — a chip on [changedAxis] was just tapped and that
///    combination doesn't exist — the variant WITH the tapped value that keeps
///    the most other selections, preferring in-stock, then the earliest
///    (admin order).
/// 3. Otherwise the best partial match overall, then the first variant.
///
/// Returns null only for an empty list.
Variant? resolveVariant(
  List<Variant> variants,
  Map<String, String> selection, {
  String? changedAxis,
}) {
  if (variants.isEmpty) return null;
  final scored = [
    for (var i = 0; i < variants.length; i++)
      (v: variants[i], index: i, values: axisValues(variants[i])),
  ];

  for (final s in scored) {
    if (_matchCount(s.values, selection) == selection.length) return s.v;
  }

  final pool = changedAxis == null
      ? scored
      : scored
          .where((s) => (s.values[changedAxis] ?? '') == selection[changedAxis])
          .toList();
  final candidates = pool.isNotEmpty ? pool : scored;

  // Dart's List.sort is not stable — the index tiebreak makes it total.
  final ranked = [...candidates]..sort((a, b) {
      final stockA = a.v.stock > 0 ? 1 : 0;
      final stockB = b.v.stock > 0 ? 1 : 0;
      if (stockA != stockB) return stockB - stockA;
      final scoreA = _matchCount(a.values, selection, skip: changedAxis);
      final scoreB = _matchCount(b.values, selection, skip: changedAxis);
      if (scoreA != scoreB) return scoreB - scoreA;
      return a.index - b.index;
    });
  return ranked.first.v;
}

/// How a chip renders: normal, greyed-but-tappable, or disabled.
enum ChipState { available, elsewhere, soldOut }

/// The display state of one chip — THE rule both storefronts use for greying
/// (mirrors `chipState` in variantOptions.ts).
///
/// A row is judged only against the rows ABOVE it (Colour, then the unit axes
/// in [variantAxisList] order): Colour shows whether it has stock at all; Size
/// whether it is in stock in the chosen colour; Layer whether it is in stock in
/// the chosen colour AND size. Judging against every other pick would dim the
/// colour swatches because of the size the shopper happens to be on.
///
/// - [ChipState.available]: an in-stock variant has this value and matches
///   every row above.
/// - [ChipState.elsewhere]: in stock, just not with the rows above — greyed but
///   tappable ([resolveVariant] then moves the other rows).
/// - [ChipState.soldOut]: no in-stock variant has this value at all.
ChipState chipState(
  List<Variant> variants,
  Map<String, String> selection,
  String axis,
  String value,
) {
  final order = [colourAxis, for (final r in variantAxisList(variants)) r.axis];
  final index = order.indexOf(axis);
  final above = order.sublist(0, index < 0 ? 0 : index);
  final withValue = variants
      .where((v) => v.stock > 0 && (axisValues(v)[axis] ?? '') == value)
      .toList();
  if (withValue.isEmpty) return ChipState.soldOut;
  final fits = withValue.any((v) {
    final values = axisValues(v);
    return above.every((a) => (values[a] ?? '') == (selection[a] ?? ''));
  });
  return fits ? ChipState.available : ChipState.elsewhere;
}

/// Whether tapping [value] on [axis] lands on an in-stock variant that keeps
/// every OTHER current selection. Stricter than [chipState] (which the
/// storefronts use for greying).
bool isComboAvailable(
  List<Variant> variants,
  Map<String, String> selection,
  String axis,
  String value,
) {
  final others = selection.keys.where((a) => a != axis).length;
  return variants.any((v) {
    if (v.stock <= 0) return false;
    final values = axisValues(v);
    return (values[axis] ?? '') == value &&
        _matchCount(values, selection, skip: axis) == others;
  });
}
