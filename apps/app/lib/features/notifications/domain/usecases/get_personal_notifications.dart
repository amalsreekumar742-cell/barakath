import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/notification_repository.dart';
import 'get_broadcast_notifications.dart';

/// One page of notifications addressed to the signed-in customer
/// (`targetUserIds array-contains uid`).
@injectable
class GetPersonalNotifications
    implements UseCase<NotificationPageResult, NotificationPageParams> {
  GetPersonalNotifications(this._repository);

  final NotificationRepository _repository;

  @override
  Future<Either<Failure, NotificationPageResult>> call(
    NotificationPageParams params,
  ) =>
      _repository.getPersonal(
        limit: params.limit,
        startAfter: params.startAfter,
      );
}
