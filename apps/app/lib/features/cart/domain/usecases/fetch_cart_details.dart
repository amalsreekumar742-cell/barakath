import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart_details.dart';
import '../repositories/cart_pricing_repository.dart';

/// Re-read the live product + variant behind every line in the bag, so prices
/// and stock shown at checkout are the server's, not the phone's.
@injectable
class FetchCartDetails implements UseCase<CartDetails, FetchCartDetailsParams> {
  FetchCartDetails(this._repository);

  final CartPricingRepository _repository;

  @override
  Future<Either<Failure, CartDetails>> call(FetchCartDetailsParams params) =>
      _repository.fetchDetails(params.lines);
}

class FetchCartDetailsParams {
  const FetchCartDetailsParams(this.lines);

  final List<({String productId, String variantId})> lines;
}
