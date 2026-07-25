import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/cart_details.dart';

/// Live catalogue data for the bag. Separate from [CartRepository] (which owns
/// the locally-persisted lines) because this one is a remote read with entirely
/// different failure modes.
abstract class CartPricingRepository {
  Future<Either<Failure, CartDetails>> fetchDetails(
    List<({String productId, String variantId})> lines,
  );
}
