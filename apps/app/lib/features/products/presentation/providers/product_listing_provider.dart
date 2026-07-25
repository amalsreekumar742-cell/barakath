import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/utils/constants.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/variant.dart';
import '../../domain/repositories/product_repository.dart';
import '../../domain/usecases/get_first_variants.dart';
import '../../domain/usecases/get_products.dart';

/// State for the product listing screen (spec §2.9): a cursor-paginated,
/// filtered and sorted product grid plus each product's first variant.
///
/// One provider instance backs whichever listing is on screen (category,
/// sub-category, new arrivals), so every entry point must call
/// [fetchProducts] with its own filters — that resets the cursor and the list.
@injectable
class ProductListingProvider extends ChangeNotifier {
  ProductListingProvider(this._getProducts, this._getFirstVariants);

  final GetProducts _getProducts;
  final GetFirstVariants _getFirstVariants;

  /// Image-heavy cards → the low end of the page-size range.
  static const int _pageSize = PageSizes.heavy;

  /// How many extra pages we'll pull to fill a screen when the client-side
  /// price filter rejects most of a page. Bounded so a narrow range can't turn
  /// one scroll into an unbounded read loop.
  static const int _maxFillPages = 3;

  final List<Product> _products = [];
  final Map<String, Variant> _variants = {};

  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  Object? _lastDocument;
  String? _error;

  // --- Filter state ----------------------------------------------------------
  String? _categoryId;
  String? _subCategory;
  ProductSort _sortBy = ProductSort.newest;
  double? _priceMin;
  double? _priceMax;

  /// "4.5 & up" style floor from the filter sheet. Applied client-side beside
  /// the price: sorting already claims `averageRating`, and Firestore allows
  /// only one range field per query.
  double? _minRating;
  bool _newArrivalsOnly = false;
  bool _flashSaleOnly = false;

  List<Product> get products => List.unmodifiable(_products);
  Map<String, Variant> get variants => Map.unmodifiable(_variants);
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  Object? get lastDocument => _lastDocument;
  String? get error => _error;

  String? get categoryId => _categoryId;
  String? get subCategory => _subCategory;
  ProductSort get sortBy => _sortBy;
  double? get priceMin => _priceMin;
  double? get priceMax => _priceMax;
  double? get minRating => _minRating;
  bool get newArrivalsOnly => _newArrivalsOnly;
  bool get flashSaleOnly => _flashSaleOnly;

  /// Drives the "Filters" button badge. Sort is not counted — it has its own
  /// control and is never "off".
  int get activeFilterCount {
    var count = 0;
    if (_subCategory != null && _subCategory!.isNotEmpty) count++;
    if (_priceMin != null || _priceMax != null) count++;
    if (_minRating != null) count++;
    return count;
  }

  bool get hasActiveFilters => activeFilterCount > 0;

  Variant? variantFor(String productId) => _variants[productId];

  /// Start a listing: REPLACES the whole filter set (a null argument clears
  /// that filter) and loads the first page from scratch.
  ///
  /// WHY replace rather than merge: one provider instance is reused by every
  /// listing entry point, so a merge would leak the previous screen's category
  /// or price range into the next one.
  Future<void> fetchProducts({
    String? categoryId,
    String? subCategory,
    bool newArrivalsOnly = false,
    bool flashSaleOnly = false,
    ProductSort sortBy = ProductSort.newest,
    double? priceMin,
    double? priceMax,
  }) async {
    _categoryId = categoryId;
    _subCategory = subCategory;
    _newArrivalsOnly = newArrivalsOnly;
    _flashSaleOnly = flashSaleOnly;
    _sortBy = sortBy;
    _priceMin = priceMin;
    _priceMax = priceMax;
    await resetAndFetch();
  }

  /// Clear the list + cursor and re-run the query with the current filters.
  Future<void> resetAndFetch() async {
    _products.clear();
    _variants.clear();
    _lastDocument = null;
    _hasMore = true;
    _error = null;
    _isLoading = true;
    notifyListeners();

    await _loadPage(fillPagesRemaining: _maxFillPages);

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch the next page — called by the grid's scroll listener near the bottom.
  Future<void> loadMore() async {
    if (_isLoading || _isLoadingMore || !_hasMore) return;

    _isLoadingMore = true;
    notifyListeners();

    await _loadPage(fillPagesRemaining: _maxFillPages);

    _isLoadingMore = false;
    notifyListeners();
  }

  Future<void> updateSort(ProductSort sort) async {
    if (sort == _sortBy) return;
    _sortBy = sort;
    await resetAndFetch();
  }

  /// Price bounds are compared against the VARIANT's effective price, which
  /// Firestore can't filter on from a parent query — see [_matchesPrice].
  Future<void> updatePriceRange(double? min, double? max) async {
    _priceMin = min;
    _priceMax = max;
    await resetAndFetch();
  }

  Future<void> updateSubCategory(String? subCategory) async {
    if (subCategory == _subCategory) return;
    _subCategory = subCategory;
    await resetAndFetch();
  }

  /// Apply the filter sheet's whole result in one go — one refetch instead of
  /// the three [updateSubCategory]/[updatePriceRange] would cause.
  Future<void> applyFilters({
    String? subCategory,
    double? priceMin,
    double? priceMax,
    double? minRating,
  }) async {
    _subCategory = subCategory;
    _priceMin = priceMin;
    _priceMax = priceMax;
    _minRating = minRating;
    await resetAndFetch();
  }

  /// Drop the user-applied filters but keep the listing's own context (the
  /// category / new-arrivals scope the screen was opened with).
  Future<void> clearFilters() async {
    _subCategory = null;
    _priceMin = null;
    _priceMax = null;
    _minRating = null;
    _sortBy = ProductSort.newest;
    await resetAndFetch();
  }

  /// Loads one server page, appends what survives the client-side price filter,
  /// and repeats while the page came back empty *after* filtering — otherwise a
  /// narrow price range would show a blank grid that never triggers a scroll.
  Future<void> _loadPage({required int fillPagesRemaining}) async {
    final result = await _getProducts(
      GetProductsParams(
        categoryId: _categoryId,
        subCategory: _subCategory,
        newArrivalsOnly: _newArrivalsOnly,
        flashSaleOnly: _flashSaleOnly,
        sortBy: _sortBy,
        limit: _pageSize,
        startAfter: _lastDocument,
      ),
    );

    final page = result.fold<ProductPageResult?>(
      (failure) {
        _error = failure.message;
        _hasMore = false;
        return null;
      },
      (page) {
        _error = null;
        return page;
      },
    );
    if (page == null) return;

    _lastDocument = page.nextCursor ?? _lastDocument;
    _hasMore = page.hasMore;

    // Dedup by id — a cursor page can overlap after a concurrent write.
    final known = _products.map((product) => product.id).toSet();
    final fresh = page.items.where((product) => known.add(product.id)).toList();

    if (fresh.isNotEmpty) {
      await _loadVariantsFor(fresh);
      _products.addAll(fresh.where(_matchesPrice));
    }

    final needsMore = _hasMore && fresh.where(_matchesPrice).isEmpty;
    if (needsMore && fillPagesRemaining > 0) {
      await _loadPage(fillPagesRemaining: fillPagesRemaining - 1);
    }
  }

  Future<void> _loadVariantsFor(List<Product> products) async {
    final result = await _getFirstVariants(products.map((p) => p.id).toList());
    // A variant read failing must not blank the grid — the card falls back to
    // the product's own thumbnail and price range.
    result.fold<void>((_) {}, (variants) => _variants.addAll(variants));
  }

  /// CLIENT-SIDE price filter. `offerPrice` lives on the `variants`
  /// subcollection, and Firestore cannot constrain a parent query by a child
  /// document's field, so the range is applied to the page we just fetched.
  bool _matchesPrice(Product product) {
    if (_minRating != null && product.averageRating < _minRating!) return false;
    if (_priceMin == null && _priceMax == null) return true;
    final variant = _variants[product.id];
    final price = variant?.effectivePrice ?? product.minPrice;
    if (_priceMin != null && price < _priceMin!) return false;
    if (_priceMax != null && price > _priceMax!) return false;
    return true;
  }
}
