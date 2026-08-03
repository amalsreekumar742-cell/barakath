import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/utils/youtube_url.dart';
import '../../../reviews/domain/entities/review.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/variant.dart';
import '../../domain/entities/variant_option.dart';
import '../../domain/repositories/product_detail_repository.dart';
import '../../domain/usecases/get_bundle_products.dart';
import '../../domain/usecases/get_first_variants.dart';
import '../../domain/usecases/get_product_detail.dart';
import '../../domain/usecases/get_product_variants.dart';
import '../../domain/usecases/get_products.dart';
import '../../domain/usecases/get_recent_product_reviews.dart';

/// Explicit screen state — the UI switches on this, never on null-checks
/// (skill: "Loading/error/data state must come from the Provider as an explicit
/// named state").
enum ProductDetailStatus { initial, loading, loaded, error }

/// State for the Product Detail screen (spec §2.10).
///
/// WHY the product is fetched first and the rest in parallel: the bundle query
/// needs `frequentlyBoughtTogether` off the product doc, but variants and
/// reviews don't — so they fan out together once the doc lands, keeping the
/// screen's time-to-content at two round trips instead of four.
///
/// WHY the satellite failures don't fail the screen: a missing bundle item or a
/// reviews index that hasn't finished building must not hide a purchasable
/// product. Only the product document itself is fatal.
@injectable
class ProductDetailProvider extends ChangeNotifier {
  ProductDetailProvider(
    this._getProductDetail,
    this._getProductVariants,
    this._getBundleProducts,
    this._getRecentProductReviews,
    this._getProducts,
    this._getFirstVariants,
  );

  final GetProductDetail _getProductDetail;
  final GetProductVariants _getProductVariants;
  final GetBundleProducts _getBundleProducts;
  final GetRecentProductReviews _getRecentProductReviews;
  final GetProducts _getProducts;
  final GetFirstVariants _getFirstVariants;

  ProductDetailStatus _status = ProductDetailStatus.initial;
  String _errorMessage = '';
  Product? _product;
  List<Variant> _variants = const [];
  Variant? _selectedVariant;
  int _selectedImageIndex = 0;
  List<BundleItem> _bundleItems = const [];
  List<Review> _reviews = const [];
  List<Product> _relatedProducts = const [];
  final Map<String, Variant> _relatedVariants = {};

  ProductDetailStatus get status => _status;
  bool get isLoading => _status == ProductDetailStatus.loading;
  bool get hasError => _status == ProductDetailStatus.error;
  String get errorMessage => _errorMessage;

  Product? get product => _product;
  List<Variant> get variants => List.unmodifiable(_variants);
  Variant? get selectedVariant => _selectedVariant;
  int get selectedImageIndex => _selectedImageIndex;
  List<BundleItem> get bundleItems => List.unmodifiable(_bundleItems);
  List<Review> get reviews => List.unmodifiable(_reviews);

  /// "You may also like" — other products in the same category. There is no
  /// curated related-products field, so the department is the closest honest
  /// signal; a failure here just hides the rail.
  List<Product> get relatedProducts => List.unmodifiable(_relatedProducts);
  Variant? relatedVariantOf(String productId) => _relatedVariants[productId];

  /// Star-count distribution (5→1) across the reviews we loaded, for the
  /// design's rating bars. Reflects the recent page, not every review ever
  /// written — the totals aren't aggregated server-side.
  Map<int, int> get ratingBreakdown {
    final counts = {for (var star = 1; star <= 5; star++) star: 0};
    for (final review in _reviews) {
      final star = review.rating.round().clamp(1, 5);
      counts[star] = (counts[star] ?? 0) + 1;
    }
    return counts;
  }

  /// Images of the selected variant, falling back to the product's own gallery
  /// when the variant carries none (variant images are optional in the schema).
  List<String> get galleryImages {
    final variantImages = _selectedVariant?.images ?? const <String>[];
    if (variantImages.isNotEmpty) return variantImages;
    final productImages = _product?.images ?? const <String>[];
    if (productImages.isNotEmpty) return productImages;
    final thumbnail = _product?.thumbnail ?? '';
    return thumbnail.isEmpty ? const [] : [thumbnail];
  }

  /// What the customer pays for the selected variant: flash price when live.
  double get effectivePrice =>
      _selectedVariant?.flashSalePrice ?? _selectedVariant?.offerPrice ?? 0;

  double get mrp => _selectedVariant?.mrp ?? 0;

  /// Rounded discount of [effectivePrice] against MRP; 0 when there is none.
  int get discountPercentage {
    final variant = _selectedVariant;
    if (variant == null || variant.mrp <= 0) return 0;
    if (effectivePrice >= variant.mrp) return 0;
    return (((variant.mrp - effectivePrice) / variant.mrp) * 100).round();
  }

  bool get isInStock => (_selectedVariant?.stock ?? 0) > 0;

  /// True only in the warning band — above zero but at/under the product's
  /// configured low-stock threshold.
  bool get isLowStock {
    final variant = _selectedVariant;
    final threshold = _product?.lowStockThreshold ?? 0;
    if (variant == null) return false;
    return variant.stock > 0 && variant.stock <= threshold;
  }

  /// True when every variant is sold out — the whole screen goes non-purchasable.
  bool get isEverythingOutOfStock =>
      _variants.isEmpty || _variants.every((v) => v.stock <= 0);

  bool get hasReviews => _reviews.isNotEmpty;

  /// Load the product and everything the detail screen renders around it.
  Future<void> fetchProductDetail(String productId) async {
    _status = ProductDetailStatus.loading;
    _errorMessage = '';
    notifyListeners();

    final productResult = await _getProductDetail(productId);
    final product = productResult.fold<Product?>((failure) {
      _errorMessage = failure.message;
      return null;
    }, (value) => value);

    if (product == null) {
      _status = ProductDetailStatus.error;
      notifyListeners();
      return;
    }

    _product = product;

    // Kicked off together, awaited in turn — the three run in parallel while
    // each result stays statically typed (a heterogeneous `Future.wait` would
    // collapse them to a common supertype).
    final variantsFuture = _getProductVariants(productId);
    final bundleFuture = _getBundleProducts(product.frequentlyBoughtTogether);
    final reviewsFuture =
        _getRecentProductReviews(RecentReviewsParams(productId: productId));

    (await variantsFuture).fold(
      (_) => _variants = const <Variant>[],
      // Copied into a genuine List<Variant>: the datasource hands back a
      // List<VariantModel>, and Dart keeps that reified element type even
      // though the static type here is List<Variant>. Any later
      // `firstWhere(..., orElse: () => <a Variant>)` on it then fails at RUNTIME
      // with "type '() => Variant' is not a subtype of '(() => VariantModel)?'",
      // which no amount of analysis catches. One copy at the boundary makes
      // every downstream use of this list safe.
      (value) => _variants = List<Variant>.of(value),
    );
    (await bundleFuture).fold(
      (_) => _bundleItems = const <BundleItem>[],
      (value) => _bundleItems = value,
    );
    (await reviewsFuture).fold(
      (_) => _reviews = const <Review>[],
      (value) => _reviews = value,
    );

    // Default selection: the first (oldest) variant, matching the merchant's
    // authoring order.
    _selectedVariant = _variants.isEmpty ? null : _variants.first;
    _selectedImageIndex = 0;
    _status = ProductDetailStatus.loaded;
    notifyListeners();

    // Related products come AFTER the screen is usable — they sit at the very
    // bottom, so they must never delay the price and Add-to-bag button.
    unawaited(_loadRelated(product));
  }

  Future<void> _loadRelated(Product product) async {
    _relatedProducts = const [];
    _relatedVariants.clear();
    if (product.categoryId.trim().isEmpty) return;

    final result = await _getProducts(
      GetProductsParams(categoryId: product.categoryId, limit: 10),
    );
    final page = result.fold<List<Product>>((_) => const [], (p) => p.items);

    // Never recommend the product the customer is already looking at.
    final related =
        page.where((item) => item.id != product.id).take(6).toList();
    if (related.isEmpty) return;

    final variants = await _getFirstVariants(related.map((p) => p.id).toList());
    variants.fold<void>((_) {}, _relatedVariants.addAll);

    _relatedProducts = related;
    notifyListeners();
  }

  /// Switch the active variant. Resets the gallery because a variant can carry
  /// its own images and index 3 of the old set may not exist in the new one.
  void selectVariant(Variant variant) {
    if (_selectedVariant?.id == variant.id) return;
    _selectedVariant = variant;
    _selectedImageIndex = 0;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Colour / size axes
  //
  // A variant is a (colour, size) PAIR, but the shopper picks one axis at a
  // time. The catalogue's pairs are SPARSE — a product with 3 colours and 3
  // sizes typically has 3 variants (Gold/30ml, Amber/50ml, Emerald/100ml), not
  // 9 — so the two rows cannot be independent: most combinations the shopper
  // could compose simply do not exist.
  //
  // The rule below never dead-ends. Tapping an axis value ALWAYS keeps that
  // value and moves the other axis to the nearest real variant:
  //   1. the exact pair, if the merchant created it;
  //   2. otherwise the first variant carrying the tapped value, preferring one
  //      that is in stock.
  // So every chip is live, every tap lands on a real variant, and no shopper is
  // shown a price or an Add-to-bag button for something that was never sold.
  // ---------------------------------------------------------------------------

  /// The selected variant's colour, or '' when nothing is selected.
  String get selectedColor => _selectedVariant?.color.trim() ?? '';

  /// The selected variant's size/unit label, or '' when nothing is selected.
  String get selectedSize => _selectedVariant?.name.trim() ?? '';

  List<String> _distinct(String Function(Variant) pick) {
    final seen = <String>{};
    final values = <String>[];
    for (final variant in _variants) {
      final value = pick(variant).trim();
      // Authoring order is the merchant's order — never sorted alphabetically.
      if (value.isNotEmpty && seen.add(value)) values.add(value);
    }
    return values;
  }

  /// The colour row. Empty when no variant names a colour, which hides the row
  /// rather than rendering a header over nothing.
  List<VariantOption> get colorOptions => _distinct((v) => v.color)
      .map(
        (color) => VariantOption(
          value: color,
          colorCode: _variants
              .firstWhere((v) => v.color.trim() == color)
              .colorCode,
          soldOut: _variants
              .where((v) => v.color.trim() == color)
              .every((v) => v.stock <= 0),
        ),
      )
      .toList();

  /// The size/unit row. Empty when no variant names a size.
  List<VariantOption> get sizeOptions => _distinct((v) => v.name)
      .map(
        (size) => VariantOption(
          value: size,
          colorCode: '',
          soldOut:
              _variants.where((v) => v.name.trim() == size).every((v) => v.stock <= 0),
        ),
      )
      .toList();

  /// Selects the best variant for [color], keeping the current size when that
  /// pair exists. Returns the variant now selected so the caller can react to a
  /// sold-out landing (null when the product has no such colour).
  Variant? selectColor(String color) => _selectAxis(
        matches: (v) => v.color.trim() == color.trim(),
        keeps: (v) => v.name.trim() == selectedSize,
      );

  /// Selects the best variant for [size], keeping the current colour when that
  /// pair exists.
  Variant? selectSize(String size) => _selectAxis(
        matches: (v) => v.name.trim() == size.trim(),
        keeps: (v) => v.color.trim() == selectedColor,
      );

  Variant? _selectAxis({
    required bool Function(Variant) matches,
    required bool Function(Variant) keeps,
  }) {
    final candidates = <Variant>[..._variants.where(matches)];
    if (candidates.isEmpty) return null;

    final exact = <Variant>[...candidates.where(keeps)];
    final pool = exact.isNotEmpty ? exact : candidates;
    // Prefer something buyable, but only among variants that already carry the
    // tapped value — the tapped axis is never silently overridden.
    //
    // Written as a loop rather than `firstWhere(..., orElse: …)` on purpose: the
    // orElse closure's return type is checked against the list's REIFIED element
    // type, so that form throws at runtime the moment this list is backed by
    // subtype instances. A loop has no such trap.
    var variant = pool.first;
    for (final candidate in pool) {
      if (candidate.stock > 0) {
        variant = candidate;
        break;
      }
    }
    selectVariant(variant);
    return variant;
  }

  /// Pages the gallery shows: every image, plus one for the product video when
  /// the link parses. The video page is the LAST index, so the bound below has
  /// to include it — otherwise swiping or tapping through to the video is
  /// silently rejected and the carousel snaps back to the last photo.
  int get galleryPageCount =>
      galleryImages.length +
      (YoutubeUrl.extractId(_product?.youtubeVideoLink ?? '') == null ? 0 : 1);

  void selectImage(int index) {
    if (index == _selectedImageIndex) return;
    if (index < 0 || index >= galleryPageCount) return;
    _selectedImageIndex = index;
    notifyListeners();
  }
}
