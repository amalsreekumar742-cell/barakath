// `foundation` also exports a `Category` annotation — hide it so the catalogue
// entity of the same name resolves unambiguously.
import 'package:flutter/foundation.dart' hide Category;
import 'package:injectable/injectable.dart';

import '../../domain/entities/category.dart';
import '../../domain/usecases/get_categories.dart';
import '../../domain/usecases/get_category_by_id.dart';

/// Holds the catalogue's category list (spec §2.8) for the Categories tab, the
/// sub-category screen and the listing screen's filter sheet.
///
/// The list is small and admin-curated, so it is fetched once and kept — every
/// later `getCategoryById` is answered from memory and only falls back to a
/// document read when the screen was deep-linked before the list loaded.
@injectable
class CategoriesProvider extends ChangeNotifier {
  CategoriesProvider(this._getCategories, this._getCategoryById);

  final GetCategories _getCategories;
  final GetCategoryById _getCategoryById;

  List<Category> _categories = const [];
  bool _isLoading = false;
  bool _loadedOnce = false;
  String? _error;

  List<Category> get categories => _categories;
  bool get isLoading => _isLoading;
  bool get loadedOnce => _loadedOnce;
  String? get error => _error;

  /// Fetch (or re-fetch) the category list. Safe to call from `initState`.
  Future<void> fetchCategories({int limit = 50}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    final result = await _getCategories(GetCategoriesParams(limit: limit));
    result.fold(
      (failure) => _error = failure.message,
      (categories) {
        _categories = categories;
        _error = null;
      },
    );

    _isLoading = false;
    _loadedOnce = true;
    notifyListeners();
  }

  /// A category already in memory, or null — for synchronous widget builds that
  /// must not trigger a fetch.
  Category? cachedCategory(String id) {
    for (final category in _categories) {
      if (category.id == id) return category;
    }
    return null;
  }

  /// A category by id: the cached one when the list is loaded, otherwise a
  /// single-document read (deep link straight into a listing screen).
  Future<Category?> getCategoryById(String id) async {
    final cached = cachedCategory(id);
    if (cached != null) return cached;

    final result = await _getCategoryById(id);
    return result.fold((failure) {
      _error = failure.message;
      notifyListeners();
      return null;
    }, (category) {
      // Keep it so the filter sheet / title can read it without another read.
      _categories = [..._categories, category];
      notifyListeners();
      return category;
    });
  }
}
