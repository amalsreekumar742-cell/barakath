import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/usecase/usecase.dart';
import '../../../../core/utils/constants.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../../domain/usecases/add_recent_search.dart';
import '../../domain/usecases/clear_recent_searches.dart';
import '../../domain/usecases/get_recent_searches.dart';
import '../../domain/usecases/remove_recent_search.dart';
import '../../domain/usecases/search_products.dart';

/// Drives the search screen (spec §2.7): keyword product search with cursor
/// paging, plus the on-device recent-search history and a trending list.
///
/// Guests search freely — nothing here is auth-gated.
@injectable
class SearchProvider extends ChangeNotifier {
  SearchProvider(
    this._searchProducts,
    this._getRecentSearches,
    this._addRecentSearch,
    this._removeRecentSearch,
    this._clearRecentSearches,
  );

  final SearchProducts _searchProducts;
  final GetRecentSearches _getRecentSearches;
  final AddRecentSearch _addRecentSearch;
  final RemoveRecentSearch _removeRecentSearch;
  final ClearRecentSearches _clearRecentSearches;

  /// Below this a query matches almost everything and is not worth a read.
  static const int minQueryLength = 2;

  /// Result cards are image-heavy, so a small page (skill: heavy items = 10).
  static const int _pageSize = PageSizes.heavy;

  // --- State ----------------------------------------------------------------
  List<Product> _results = [];
  final Map<String, Variant> _firstVariants = {};
  List<String> _recentSearches = [];
  List<String> _trendingSearches = [];
  bool _isSearching = false;
  bool _isLoadingMore = false;
  bool _hasMore = false;
  Object? _cursor;
  String _query = '';
  String? _error;

  /// The query whose response we are still willing to accept. Typing again
  /// while a search is in flight moves this on, so a slow earlier response can
  /// be recognised as stale and dropped instead of overwriting newer results.
  String? _inFlightQuery;

  List<Product> get results => List.unmodifiable(_results);
  Map<String, Variant> get firstVariants => Map.unmodifiable(_firstVariants);
  List<String> get recentSearches => List.unmodifiable(_recentSearches);
  List<String> get trendingSearches => List.unmodifiable(_trendingSearches);
  bool get isSearching => _isSearching;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String get query => _query;
  String? get error => _error;

  /// True while the screen should show recent/trending instead of results.
  bool get isInitial => _query.length < minQueryLength && !_isSearching;

  /// The first variant for [productId], if it has been loaded.
  Variant? variantFor(String productId) => _firstVariants[productId];

  // --- Search ---------------------------------------------------------------

  /// Run a fresh search for [query]. Short queries clear the screen back to the
  /// initial view without touching the network.
  Future<void> search(String query) async {
    final clean = query.trim();
    if (clean.length < minQueryLength) {
      clearResults();
      return;
    }

    _query = clean;
    _inFlightQuery = clean;
    _isSearching = true;
    // A page still in flight from the previous query is abandoned below, so its
    // loading flag must not stick around and block the next loadMore().
    _isLoadingMore = false;
    _error = null;
    _results = [];
    _firstVariants.clear();
    _cursor = null;
    _hasMore = false;
    notifyListeners();

    final result = await _searchProducts(
      SearchProductsParams(query: clean, limit: _pageSize),
    );

    // A newer keystroke already started another search (or the field was
    // cleared) — this response is stale and must not land.
    if (_inFlightQuery != clean) return;

    result.fold(
      (failure) {
        _error = failure.message;
        _results = [];
      },
      (page) {
        _results = page.products;
        _firstVariants.addAll(page.firstVariants);
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
      },
    );
    _isSearching = false;
    notifyListeners();

    // Only a term the customer actually searched is worth remembering.
    if (_error == null) await _rememberTerm(clean);
  }

  /// Append the next page. No-op while a page is already loading, when the
  /// result set is exhausted, or before a first search has run.
  Future<void> loadMore() async {
    if (_isLoadingMore || _isSearching || !_hasMore || _cursor == null) return;

    final forQuery = _query;
    _isLoadingMore = true;
    notifyListeners();

    final result = await _searchProducts(
      SearchProductsParams(
        query: forQuery,
        limit: _pageSize,
        startAfter: _cursor,
      ),
    );

    // The query moved on while this page was in flight — discard it.
    if (_query != forQuery || _inFlightQuery != forQuery) return;

    result.fold(
      (failure) => _error = failure.message,
      (page) {
        // Firestore can re-serve a boundary doc; dedupe so the grid never
        // renders the same product twice.
        final seen = _results.map((p) => p.id).toSet();
        _results = [
          ..._results,
          ...page.products.where((p) => seen.add(p.id)),
        ];
        _firstVariants.addAll(page.firstVariants);
        _cursor = page.nextCursor;
        _hasMore = page.hasMore;
      },
    );
    _isLoadingMore = false;
    notifyListeners();
  }

  /// Return to the initial (recent + trending) view.
  void clearResults() {
    _query = '';
    _inFlightQuery = null; // invalidates anything still in flight
    _results = [];
    _firstVariants.clear();
    _cursor = null;
    _hasMore = false;
    _isSearching = false;
    _isLoadingMore = false;
    _error = null;
    notifyListeners();
  }

  /// Re-run the current query — the retry action on the error state.
  Future<void> retry() => search(_query);

  // --- Recent searches ------------------------------------------------------

  Future<void> loadRecentSearches() async {
    final result = await _getRecentSearches(const NoParams());
    result.fold(
      (_) => _recentSearches = const [],
      (terms) => _recentSearches = terms,
    );
    notifyListeners();
  }

  Future<void> removeRecentSearch(String term) async {
    final result = await _removeRecentSearch(term);
    result.fold((_) {}, (terms) {
      _recentSearches = terms;
      notifyListeners();
    });
  }

  Future<void> clearRecentSearches() async {
    final result = await _clearRecentSearches(const NoParams());
    result.fold((_) {}, (_) {
      _recentSearches = const [];
      notifyListeners();
    });
  }

  Future<void> _rememberTerm(String term) async {
    final result = await _addRecentSearch(term);
    result.fold((_) {}, (terms) {
      _recentSearches = terms;
      notifyListeners();
    });
  }

  // --- Trending -------------------------------------------------------------

  /// TODO: source these from the `general/config` settings doc so admin can
  /// curate them; hardcoded until that field exists.
  void loadTrendingSearches() {
    _trendingSearches = const [
      'Attar',
      'Prayer Mat',
      'Islamic Books',
      'Perfume',
      'Thobes',
    ];
    notifyListeners();
  }
}
