import '../../domain/entities/search_results.dart';

/// Data-layer view of a results page. Adds nothing to [SearchResults] except a
/// concrete constructor — the Firestore `DocumentSnapshot` cursor is stored in
/// the inherited `nextCursor` as an opaque `Object?`, so nothing above `data/`
/// ever sees a Firestore type.
class SearchResultsModel extends SearchResults {
  const SearchResultsModel({
    required super.products,
    required super.firstVariants,
    required super.nextCursor,
    required super.hasMore,
  });
}
