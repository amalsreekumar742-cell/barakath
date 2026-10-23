import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/entities/variant.dart';
import '../models/variant_model.dart';

/// The ONE rule for which variant is a product's "first" (its default: card
/// price, detail-screen pre-selection, bundle tile) and how its variants are
/// ordered — the admin's ▲/▼ `sortOrder`, ascending.
///
/// WHY one shared helper instead of a query per datasource: home, the listing,
/// search and the detail screen each read variants, and "first variant" has to
/// mean the SAME variant on all of them — otherwise one product shows one price
/// in search and another in the listing (seen live: ₹150 vs ₹101). The website
/// applies the identical rule (`@barakath/shared/utils/sortVariants`).
///
/// WHY every read needs a fallback: variants written before reordering existed
/// carry no `sortOrder` until the backfill runs, and Firestore SILENTLY EXCLUDES
/// documents missing an `orderBy` field — an ordered query alone would make
/// those products look variant-less (a card with no price).
class VariantOrder {
  const VariantOrder._();

  /// The product's first variant in one-document reads, or null when it has
  /// none: lowest `sortOrder`; else (nobody has ordered this product yet) the
  /// oldest by `createdAt`; else any variant at all, for a doc missing both
  /// fields — so a card is never left without a price it actually has.
  static Future<VariantModel?> readFirst(
    CollectionReference<Map<String, dynamic>> variants,
  ) async {
    for (final field in const ['sortOrder', 'createdAt']) {
      final snap = await variants.orderBy(field).limit(1).get();
      if (snap.docs.isNotEmpty) return VariantModel.fromFirestore(snap.docs.first);
    }
    final snap = await variants.limit(1).get();
    return snap.docs.isEmpty ? null : VariantModel.fromFirestore(snap.docs.first);
  }

  /// [variants] (read in `createdAt` order) re-ordered for display: those with
  /// a `sortOrder` first, ascending; those without keep their `createdAt` order
  /// after them.
  ///
  /// WHY a hand-rolled stable sort: Dart's `List.sort` is not guaranteed
  /// stable, and stability is what keeps never-reordered variants in the order
  /// the merchant created them instead of shuffling them on every load.
  static List<T> sort<T extends Variant>(List<T> variants) {
    final indexed = [for (var i = 0; i < variants.length; i++) (i, variants[i])];
    indexed.sort((a, b) {
      final ra = a.$2.sortOrder;
      final rb = b.$2.sortOrder;
      if (ra != rb) {
        if (ra == null) return 1;
        if (rb == null) return -1;
        return ra.compareTo(rb);
      }
      return a.$1.compareTo(b.$1);
    });
    return [for (final (_, v) in indexed) v];
  }
}
