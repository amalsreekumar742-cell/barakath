import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/replacement.dart';
import '../entities/replacement_draft.dart';

/// Domain contract for raising a product-replacement request (spec §2.18).
abstract class ReplacementRepository {
  /// Uploads the draft's photos and creates the `replacements/{id}` document,
  /// returning the stored request.
  Future<Either<Failure, Replacement>> submitRequest(ReplacementDraft draft);
}
