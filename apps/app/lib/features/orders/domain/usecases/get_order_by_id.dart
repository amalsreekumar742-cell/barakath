import 'package:dartz/dartz.dart' hide Order;
// Both dartz and injectable export an `Order` symbol; hide both so the bare
// name always means this feature's entity.
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/order.dart';
import '../repositories/order_repository.dart';

/// Load one order document for Order Detail / Tracking / Invoice.
@injectable
class GetOrderById implements UseCase<Order, String> {
  GetOrderById(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, Order>> call(String orderId) =>
      _repository.getOrderById(orderId);
}
