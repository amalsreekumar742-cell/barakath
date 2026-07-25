import 'package:dartz/dartz.dart';
// `hide Category`: foundation exports a `Category` annotation class that would
// otherwise collide with the catalogue entity of the same name.
import 'package:flutter/foundation.dart' hide Category;
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../categories/domain/entities/category.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../../domain/entities/banner_item.dart';
import '../../domain/usecases/get_banners.dart';
import '../../domain/usecases/get_first_variants.dart';
import '../../domain/usecases/get_flash_sale_end_date.dart';
import '../../domain/usecases/get_flash_sale_products.dart';
import '../../domain/usecases/get_home_categories.dart';
import '../../domain/usecases/get_new_arrivals.dart';
import '../../domain/usecases/get_products_by_category.dart';
import '../../domain/usecases/home_limit.dart';

/// State for the home screen (spec §2.6).
///
/// WHY the sections are fetched with `Future.wait` rather than sequentially:
/// they're independent bounded reads, and serialising them would stack five
/// round-trips before the first pixel of content appears. A section that fails
/// simply stays empty and hides itself — one bad query must not blank the whole
/// screen — so [error] is only set when *everything* failed.
@injectable
class HomeProvider extends ChangeNotifier {
  HomeProvider(
    this._getBanners,
    this._getCategories,
    this._getFlashSaleProducts,
    this._getNewArrivals,
    this._getFlashSaleEndDate,
    this._getFirstVariants,
    this._getProductsByCategory,
  );

  final GetBanners _getBanners;
  final GetHomeCategories _getCategories;
  final GetFlashSaleProducts _getFlashSaleProducts;
  final GetNewArrivals _getNewArrivals;
  final GetFlashSaleEndDate _getFlashSaleEndDate;
  final GetFirstVariants _getFirstVariants;
  final GetProductsByCategory _getProductsByCategory;

  /// How many independent section reads `_load` performs — only when every one
  /// of them fails does the screen show a full error state. The per-category
  /// rows are NOT counted: they depend on the categories read, and a category
  /// with no products yet is normal rather than a failure.
  static const int _sectionCount = 5;

  /// How many category rows home shows. Home is a teaser — the Category tab is
  /// where the full list lives — so this is capped rather than following however
  /// many categories the store happens to have.
  static const int _maxCategoryRows = 3;

  // --- State ---------------------------------------------------------------
  List<BannerItem> _banners = const [];
  List<Category> _categories = const [];
  List<Product> _flashSaleProducts = const [];
  List<Product> _newArrivals = const [];
  /// categoryId -> that category's newest products. Only categories that
  /// actually have products get an entry, and at most [_maxCategoryRows] of
  /// them, so the UI can render a section per key without checking for empties
  /// or having to cap the list itself.
  Map<String, List<Product>> _categoryProducts = const {};
  Map<String, Variant> _variants = const {};
  DateTime? _flashSaleEndDate;

  bool _isLoading = false;
  bool _hasLoaded = false;
  String? _error;

  List<BannerItem> get banners => _banners;
  List<Category> get categories => _categories;
  List<Product> get flashSaleProducts => _flashSaleProducts;
  List<Product> get newArrivals => _newArrivals;

  /// The categories that have at least one product, in the order they were
  /// loaded — one home section each.
  List<Category> get categoriesWithProducts =>
      _categories.where((c) => (_categoryProducts[c.id] ?? const []).isNotEmpty).toList();

  List<Product> productsOf(String categoryId) =>
      _categoryProducts[categoryId] ?? const [];

  /// First variant per product id — the price/image source for product cards.
  /// Missing entries are normal (a product with no variants yet).
  Map<String, Variant> get variants => _variants;
  Variant? variantOf(String productId) => _variants[productId];

  DateTime? get flashSaleEndDate => _flashSaleEndDate;

  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Every section came back empty *and* nothing errored — a genuinely empty
  /// catalogue rather than a failed load.
  bool get isEmpty =>
      _banners.isEmpty &&
      _categories.isEmpty &&
      _flashSaleProducts.isEmpty &&
      _newArrivals.isEmpty &&
      _categoryProducts.isEmpty;

  // --- Loading --------------------------------------------------------------

  /// Load every section in parallel. Safe to call from `initState` — repeat
  /// calls while a load is in flight, or after one has succeeded, are ignored
  /// so a tab switch doesn't re-read Firestore.
  Future<void> fetchHomeData() async {
    if (_isLoading || _hasLoaded) return;
    await _load(showSpinner: true);
  }

  /// Pull-to-refresh: re-reads everything, keeping the current content on screen
  /// (the RefreshIndicator is the only progress signal the customer needs).
  Future<void> refreshHome() => _load(showSpinner: false);

  Future<void> _load({required bool showSpinner}) async {
    _isLoading = true;
    if (showSpinner) _error = null;
    notifyListeners();

    // Start every read before awaiting any of them — that's what makes the home
    // load one round-trip wide instead of six deep. They're awaited individually
    // afterwards (already complete) so each keeps its own static type.
    final bannersFuture = _getBanners(HomeLimit.banners);
    final categoriesFuture = _getCategories(HomeLimit.categories);
    final flashSaleFuture = _getFlashSaleProducts(HomeLimit.products);
    final newArrivalsFuture = _getNewArrivals(HomeLimit.products);
    final flashEndFuture = _getFlashSaleEndDate(const NoParams());

    await Future.wait<dynamic>([
      bannersFuture,
      categoriesFuture,
      flashSaleFuture,
      newArrivalsFuture,
      flashEndFuture,
    ]);

    var failures = 0;
    String? lastMessage;

    // Unwrap one section: its value on success, the current value left untouched
    // on failure (so a refresh that partly fails keeps what it already had).
    T take<T>(Either<Failure, T> result, T current) => result.fold(
          (failure) {
            failures++;
            lastMessage = failure.message;
            return current;
          },
          (value) => value,
        );

    _banners = take(await bannersFuture, _banners);
    _categories = take(await categoriesFuture, _categories);
    _flashSaleProducts = take(await flashSaleFuture, _flashSaleProducts);
    _newArrivals = take(await newArrivalsFuture, _newArrivals);
    _flashSaleEndDate = take(await flashEndFuture, _flashSaleEndDate);

    // Only a total wipe-out is an error state; a partial failure degrades to
    // the sections that did load.
    _error = failures == _sectionCount ? lastMessage : null;

    // Per-category rows can only be fetched once the categories are known, so
    // this is the one read that cannot join the batch above. The rows themselves
    // still all fly in parallel.
    if (_error == null) {
      await _loadCategoryProducts();
      await _loadVariants();
    }

    _isLoading = false;
    _hasLoaded = _error == null;
    notifyListeners();
  }

  /// Fetch the first variant of every product on screen in one batch — the cards
  /// can't show a real price without it. A failure here is silent: the cards
  /// fall back to the product's own thumbnail and min price.
  /// One row of products per category — at most [_maxCategoryRows] rows, all in
  /// flight together.
  ///
  /// A single failing category is swallowed rather than failing the screen: it
  /// simply gets no section, exactly like a category with no products yet. Two
  /// extra categories are queried beyond the cap for exactly that reason — an
  /// empty or failing category should cost the customer a different row, not a
  /// missing one.
  Future<void> _loadCategoryProducts() async {
    if (_categories.isEmpty) {
      _categoryProducts = const {};
      return;
    }

    final candidates = _categories.take(_maxCategoryRows + 2).toList();
    final results = await Future.wait(
      candidates.map(
        (c) => _getProductsByCategory(
          CategoryProductsParams(
            categoryId: c.id,
            limit: HomeLimit.categoryProducts.limit,
          ),
        ),
      ),
    );

    final next = <String, List<Product>>{};
    for (var i = 0; i < candidates.length && next.length < _maxCategoryRows; i++) {
      final products = results[i].fold<List<Product>>((_) => const [], (v) => v);
      if (products.isNotEmpty) next[candidates[i].id] = products;
    }
    _categoryProducts = next;
  }

  Future<void> _loadVariants() async {
    final ids = <String>{
      for (final p in _flashSaleProducts) p.id,
      for (final p in _newArrivals) p.id,
      for (final row in _categoryProducts.values)
        for (final p in row) p.id,
    }.toList();
    if (ids.isEmpty) {
      _variants = const {};
      return;
    }
    final result = await _getFirstVariants(ProductIdsParams(ids));
    result.fold((_) => _variants = const {}, (map) => _variants = map);
  }
}
