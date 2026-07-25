import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/notification_repository.dart';

/// One page of store-wide broadcasts (`targetType == 'All' && isSent == true`).
@injectable
class GetBroadcastNotifications
    implements UseCase<NotificationPageResult, NotificationPageParams> {
  GetBroadcastNotifications(this._repository);

  final NotificationRepository _repository;

  @override
  Future<Either<Failure, NotificationPageResult>> call(
    NotificationPageParams params,
  ) =>
      _repository.getBroadcasts(
        limit: params.limit,
        startAfter: params.startAfter,
      );
}

class NotificationPageParams extends Equatable {
  const NotificationPageParams({required this.limit, this.startAfter});

  final int limit;

  /// The previous page's `nextCursor`, or null for the first page.
  final Object? startAfter;

  @override
  List<Object?> get props => [limit, startAfter];
}
