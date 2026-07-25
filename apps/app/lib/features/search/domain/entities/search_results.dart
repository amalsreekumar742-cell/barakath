import 'package:equatable/equatable.dart';

import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';

/// One page of search results.
///
/// [firstVariants] maps `productId -> first variant`, because a product card
/// prices itself from its first variant and re-reading that per tile in the UI
/// would mean an N+1 read on every rebuild.
///
/// [nextCursor] is deliberately typed `Object?` — it is an OPAQUE paging token.
/// The data layer knows it is really a Firestore `DocumentSnapshot`; domain and
/// presentation only ever hand it back to the next call, which keeps Firestore
/// types out of every layer above `data/`.
class SearchResults extends Equatable {
  const SearchResults({
    required this.products,
    required this.firstVariants,
    required this.nextCursor,
    required this.hasMore,
  });

  const SearchResults.empty()
      : products = const [],
        firstVariants = const {},
        nextCursor = null,
        hasMore = false;

  final List<Product> products;
  final Map<String, Variant> firstVariants;
  final Object? nextCursor;
  final bool hasMore;

  @override
  List<Object?> get props => [products, firstVariants, nextCursor, hasMore];
}
