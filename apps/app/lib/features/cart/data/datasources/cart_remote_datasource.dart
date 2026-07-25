import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/firebase_collections.dart';
import '../../../../core/error/exceptions.dart';
import '../../../products/data/models/product_model.dart';
import '../../../products/data/models/variant_model.dart';
import '../../../products/domain/entities/product.dart';
import '../../../products/domain/entities/variant.dart';
import '../../domain/entities/cart_details.dart';
import '../../../../core/error/firebase_error_message.dart';

/// Re-reads the catalogue rows behind the bag's lines. The ONLY Firebase touch
/// point for cart pricing (skill: Firebase lives in datasources).
abstract class CartRemoteDataSource {
  /// Fetch the product + specific variant for each (productId, variantId) pair.
  /// Missing entries are simply absent from the maps — the caller treats that as
  /// "no longer available" rather than an error.
  Future<CartDetails> fetchDetails(List<({String productId, String variantId})> lines);
}

@LazySingleton(as: CartRemoteDataSource)
class CartRemoteDataSourceImpl implements CartRemoteDataSource {
  CartRemoteDataSourceImpl(this._firestore);

  final FirebaseFirestore _firestore;

  @override
  Future<CartDetails> fetchDetails(
    List<({String productId, String variantId})> lines,
  ) async {
    if (lines.isEmpty) return const CartDetails.empty();
    try {
      // One product doc + one variant doc per line, all in flight together — a
      // sequential loop would make a 10-line bag 20 round trips deep.
      final results = await Future.wait(
        lines.map((line) async {
          final productRef =
              _firestore.collection(FirebaseCollections.products).doc(line.productId);
          final snaps = await Future.wait([
            productRef.get(),
            productRef
                .collection(FirebaseCollections.variants)
                .doc(line.variantId)
                .get(),
          ]);
          return (product: snaps[0], variant: snaps[1]);
        }),
      );

      final products = <String, Product>{};
      final variants = <String, Variant>{};
      for (final result in results) {
        if (result.product.exists) {
          products[result.product.id] = ProductModel.fromFirestore(result.product);
        }
        if (result.variant.exists) {
          variants[result.variant.id] = VariantModel.fromFirestore(result.variant);
        }
      }
      return CartDetails(products: products, variants: variants);
    } on FirebaseException catch (e) {
      throw ServerException(FirebaseErrorMessage.of(e) ?? 'Could not refresh your bag.', e.code);
    }
  }
}
