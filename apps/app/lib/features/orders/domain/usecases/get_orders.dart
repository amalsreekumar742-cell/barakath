import 'package:dartz/dartz.dart' hide Order;
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/app_dimens.dart';
import '../../../../core/constants/domain_enums.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/order_repository.dart';

/// One page of the customer's orders for the My Orders list (spec §2.17).
@injectable
class GetOrders implements UseCase<OrderPageResult, GetOrdersParams> {
  GetOrders(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, OrderPageResult>> call(GetOrdersParams params) =>
      _repository.getOrders(
        filter: params.filter,
        limit: params.limit,
        startAfter: params.startAfter,
      );
}

class GetOrdersParams extends Equatable {
  const GetOrdersParams({
    this.filter = OrderFilter.all,
    this.limit = AppDimens.pageSize,
    this.startAfter,
  });

  final OrderFilter filter;
  final int limit;

  /// The previous page's `nextCursor`, or null for the first page.
  final Object? startAfter;

  @override
  List<Object?> get props => [filter, limit, startAfter];
}
