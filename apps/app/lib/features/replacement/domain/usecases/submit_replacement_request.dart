import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/replacement.dart';
import '../entities/replacement_draft.dart';
import '../repositories/replacement_repository.dart';

/// Raise a replacement request for one delivered order line (spec §2.18).
@injectable
class SubmitReplacementRequest
    implements UseCase<Replacement, ReplacementDraft> {
  SubmitReplacementRequest(this._repository);

  final ReplacementRepository _repository;

  @override
  Future<Either<Failure, Replacement>> call(ReplacementDraft draft) =>
      _repository.submitRequest(draft);
}
