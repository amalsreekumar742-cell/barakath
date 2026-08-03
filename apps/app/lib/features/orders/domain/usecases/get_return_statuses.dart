import 'package:dartz/dartz.dart' hide Order;
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/order_repository.dart';

/// `orderId` → return status, for every return the customer has raised.
///
/// My Orders labels a card with a "Return" tag from this. It cannot come off
/// the order document — a return lives in `replacements/{id}` and the order
/// carries no flag for it — and it is fetched once per list rather than once
/// per card, which would be a read per row on every scroll.
@injectable
class GetReturnStatuses implements UseCase<Map<String, String>, NoParams> {
  GetReturnStatuses(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, Map<String, String>>> call(NoParams params) =>
      _repository.getReturnStatusesByOrder();
}
