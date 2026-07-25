import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/notification_repository.dart';

/// Marks one notification read locally and returns the new full id set, so the
/// provider never has to guess what was persisted.
@injectable
class MarkNotificationRead implements UseCase<Set<String>, MarkReadParams> {
  MarkNotificationRead(this._repository);

  final NotificationRepository _repository;

  @override
  Future<Either<Failure, Set<String>>> call(MarkReadParams params) =>
      _repository.markRead(params.notificationId);
}

class MarkReadParams extends Equatable {
  const MarkReadParams(this.notificationId);

  final String notificationId;

  @override
  List<Object?> get props => [notificationId];
}
