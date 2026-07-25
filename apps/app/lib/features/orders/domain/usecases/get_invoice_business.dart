import 'package:dartz/dartz.dart' hide Order;
import 'package:injectable/injectable.dart' hide Order;

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/invoice_business.dart';
import '../repositories/order_repository.dart';

/// The seller block (name, address, GSTIN, TRN, GST rate) the invoice header
/// and footer are built from — spec Part 7.
@injectable
class GetInvoiceBusiness implements UseCase<InvoiceBusiness, NoParams> {
  GetInvoiceBusiness(this._repository);

  final OrderRepository _repository;

  @override
  Future<Either<Failure, InvoiceBusiness>> call(NoParams params) =>
      _repository.getInvoiceBusiness();
}
