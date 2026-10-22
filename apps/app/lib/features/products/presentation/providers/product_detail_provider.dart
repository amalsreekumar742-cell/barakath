import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/utils/youtube_url.dart';
import '../../../reviews/domain/entities/review.dart';
import '../../domain/entities/product.dart';
import '../../domain/entities/variant.dart';
import '../../domain/entities/variant_option.dart';
// The contract's own `VariantOption` (one unit of a variant) is not needed
// here and would clash with the chip model above.
import '../../domain/entities/variant_options.dart' hide VariantOption;
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

  /// What the customer pays for the selected variant: the flash price only
  /// when it genuinely applies (see [Variant.flashPrice]) — the same figure
  /// the bag and checkout will charge.
  double get effectivePrice =>
      _selectedVariant?.effectivePrice(
        productInFlashSale: _product?.isFlashSale ?? false,
      ) ??
      0;

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

    // Default selection: the first variant in the admin's display order — the
    // same one every product card prices from. The gallery opens on its photo.
    _selectedVariant = _variants.isEmpty ? null : _variants.first;
    final first = _selectedVariant;
    _selectedImageIndex = first == null ? 0 : _linkedImageIndex(first) ?? 0;
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

  /// Switch the active variant and slide the gallery to its photo (see
  /// [_linkedImageIndex]). With no photo linked the gallery resets to the
  /// first page, because a variant can carry its own images and index 3 of
  /// the old set may not exist in the new one.
  ///
  /// Re-tapping the variant already selected still jumps to its photo: the
  /// shopper may have swiped to another colour's photo and is asking to see
  /// this one again.
  void selectVariant(Variant variant) {
    if (_selectedVariant?.id == variant.id) {
      final linked = _linkedImageIndex(variant);
      if (linked == null || linked == _selectedImageIndex) return;
      _selectedImageIndex = linked;
      notifyListeners();
      return;
    }
    // Assigned first: [galleryImages] — which the lookup searches — follows
    // the selected variant.
    _selectedVariant = variant;
    _selectedImageIndex = _linkedImageIndex(variant) ?? 0;
    notifyListeners();
  }

  /// Which gallery page shows [variant]: its own `imageUrl`, else that of
  /// another size of the same colour (the admin links a photo once per
  /// colour), else null. A url no longer in the gallery counts as none.
  ///
  /// Mirrors `variantImageIndex` (packages/shared/src/utils/variantImage.ts),
  /// which the website uses — keep the two in step.
  int? _linkedImageIndex(Variant variant) {
    final images = galleryImages;
    int? indexOf(String url) {
      final i = url.isEmpty ? -1 : images.indexOf(url);
      return i >= 0 ? i : null;
    }

    final own = indexOf(variant.imageUrl);
    if (own != null) return own;
    for (final other in _variants) {
      if (other.color != variant.color) continue;
      final linked = indexOf(other.imageUrl);
      if (linked != null) return linked;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Variant axes — Colour, then one row per unit group (Size, Layer …)
  //
  // A variant is a COMBINATION — Colour × Size, or Colour × Size × Layer on a
  // multi-axis product — but the shopper picks one axis at a time. The
  // catalogue's combinations are SPARSE — a product with 3 colours and 3 sizes
  // typically has 3 variants (Gold/30ml, Amber/50ml, Emerald/100ml), not 9 — so
  // the rows cannot be independent: most combinations the shopper could
  // compose simply do not exist.
  //
  // Which variant a tap lands on is `resolveVariant` (variant_options.dart) —
  // the rule the website shares, so the same chips pick the same variant on
  // both surfaces. It never dead-ends. Tapping a value ALWAYS keeps that value
  // and moves the other axes to the nearest real variant:
  //   1. the exact combination, if the merchant created it;
  //   2. otherwise a variant carrying the tapped value — in stock first, then
  //      the one keeping the most of the other picks, then the admin's order.
  // So every chip is live, every tap lands on a real variant, and no shopper is
  // shown a price or an Add-to-bag button for something that was never sold.
  //
  // A legacy single-axis variant (no `options`) reads as Colour + "Size" over
  // its `name`, so these products resolve exactly as they always did.
  // ---------------------------------------------------------------------------

  /// Every axis value of the selected variant, colour included, keyed by axis
  /// name. Empty when nothing is selected.
  Map<String, String> get _selection {
    final variant = _selectedVariant;
    return variant == null ? const {} : axisValues(variant);
  }

  /// The selected variant's value on [axis] — [colourAxis] or a unit group such
  /// as "Size" — or null when nothing is selected or it has no such axis.
  String? selectedValue(String axis) => _selection[axis];

  /// The selected variant's colour, or '' when nothing is selected.
  String get selectedColor => selectedValue(colourAxis) ?? '';

  /// The colour row. Empty when no variant names a colour, which hides the row
  /// rather than rendering a header over nothing. Kept apart from [axes]
  /// because a colour chip carries a swatch (`colorCode`).
  List<VariantOption> get colorOptions {
    final seen = <String>{};
    final options = <VariantOption>[];
    for (final variant in _variants) {
      final color = variant.color;
      // Authoring order is the merchant's order — never sorted alphabetically.
      // The swatch is the first variant's of that colour.
      if (color.trim().isEmpty || !seen.add(color)) continue;
      options.add(
        VariantOption(
          value: color,
          colorCode: variant.colorCode,
          soldOut: isSoldOut(colourAxis, color),
        ),
      );
    }
    return options;
  }

  /// The non-colour rows, one per unit group, axes and values in the admin's
  /// order. A legacy product yields the single "Size" row over the variant
  /// names, exactly as before. Blank values are dropped and an axis left with
  /// none is omitted, which hides the row rather than rendering a header over
  /// nothing.
  List<VariantAxis> get axes => [
        for (final row in variantAxisList(_variants))
          if (row.values.any((value) => value.trim().isNotEmpty))
            VariantAxis(
              axis: row.axis,
              values: [
                for (final value in row.values)
                  if (value.trim().isNotEmpty) value,
              ],
            ),
      ];

  /// Whether tapping [value] on [axis] lands on something buyable — false
  /// greys the chip, which stays tappable.
  ///
  /// Uses the shared [chipState] rule (the website uses the same one): a row is
  /// judged only against the rows ABOVE it — Colour on its own, Size against the
  /// chosen colour, Layer against colour + size. So on White · 57, "Layer 3"
  /// greys when White 57 has no Layer 3 in stock, while the colour swatches
  /// never dim because of the size the shopper is on.
  bool isAvailable(String axis, String value) =>
      chipState(_variants, _selection, axis, value) == ChipState.available;

  /// True when EVERY variant carrying [value] on [axis] is out of stock — the
  /// value is gone outright, not just in the current combination.
  bool isSoldOut(String axis, String value) =>
      chipState(_variants, _selection, axis, value) == ChipState.soldOut;

  /// Selects the variant for [value] on [axis], keeping the other picks when
  /// that combination exists (see the note above). Returns the variant now
  /// selected so the caller can react to a sold-out landing; null only when the
  /// product has no variants.
  Variant? selectAxis(String axis, String value) {
    final next = {..._selection, axis: value};
    final variant = resolveVariant(_variants, next, changedAxis: axis);
    if (variant != null) selectVariant(variant);
    return variant;
  }

  /// A colour tap — the same path as every other axis.
  Variant? selectColor(String color) => selectAxis(colourAxis, color);

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
