import 'package:dartz/dartz.dart' hide Order;
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../replacement/domain/entities/replacement.dart';
import '../repositories/order_repository.dart';

/// The replacement request already raised for one order line, if any.
///
/// Order Detail shows the existing request's status instead of the "Return /
/// Replace product" button — without this a customer can raise the same request
/// twice, and nothing server-side de-duplicates them.
@injectable
class GetItemReplacement
    implements UseCase<Replacement?, ItemReplacementParams> {
  GetItemReplacement(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, Replacement?>> call(ItemReplacementParams params) =>
      _repository.getItemReplacement(
        orderId: params.orderId,
        productId: params.productId,
        variantId: params.variantId,
      );
}

class ItemReplacementParams extends Equatable {
  const ItemReplacementParams({
    required this.orderId,
    required this.productId,
    required this.variantId,
  });

  final String orderId;
  final String productId;
  final String variantId;

  @override
  List<Object?> get props => [orderId, productId, variantId];
}
