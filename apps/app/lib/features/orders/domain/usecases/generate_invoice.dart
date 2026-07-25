import 'package:dartz/dartz.dart' hide Order;
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/order_repository.dart';

/// Render the tax-invoice PDF for a Delivered order and return its URL, for the
/// share action on the Invoice screen (spec §2.19).
@injectable
class GenerateInvoice implements UseCase<String, String> {
  GenerateInvoice(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, String>> call(String orderId) =>
      _repository.generateInvoice(orderId);
}
