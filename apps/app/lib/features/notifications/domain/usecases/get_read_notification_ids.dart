import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/notification_repository.dart';

/// The ids the customer has already opened, from SharedPreferences (spec §4.18).
@injectable
class GetReadNotificationIds implements UseCase<Set<String>, NoParams> {
  GetReadNotificationIds(this._repository);

  final NotificationRepository _repository;

  @override
  Future<Either<Failure, Set<String>>> call(NoParams params) =>
      _repository.getReadIds();
}
