import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/category.dart';

/// Domain contract for reading the catalogue's categories. Implemented in the
/// data layer.
abstract class CategoryRepository {
  /// Categories in admin display order, capped at [limit].
  Future<Either<Failure, List<Category>>> getCategories({int limit});

  /// A single category by document id.
  Future<Either<Failure, Category>> getCategoryById(String id);
}
