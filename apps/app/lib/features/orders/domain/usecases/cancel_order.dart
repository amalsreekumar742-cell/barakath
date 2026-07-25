import 'package:dartz/dartz.dart' hide Order;
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/order_repository.dart';

/// Cancel a still-Pending order (spec §2.17 "Cancel item").
///
/// The refund, stock restore and coupon rewind all happen inside the
/// `cancelOrder` Cloud Function — the client only asks.
@injectable
class CancelOrder implements UseCase<Unit, CancelOrderParams> {
  CancelOrder(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(CancelOrderParams params) =>
      _repository.cancelOrder(orderId: params.orderId, reason: params.reason);
}

class CancelOrderParams extends Equatable {
  const CancelOrderParams({required this.orderId, this.reason = ''});

  final String orderId;
  final String reason;

  @override
  List<Object?> get props => [orderId, reason];
}
