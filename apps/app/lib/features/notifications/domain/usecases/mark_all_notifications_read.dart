import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/notification_repository.dart';

/// "Mark all read" — the ids currently loaded are added to the stored set.
///
/// WHY the caller supplies the ids: read state is a local list of ids, so
/// "all" can only mean "everything this device has seen". Pages the customer
/// has not loaded stay unread, which is the honest answer.
@injectable
class MarkAllNotificationsRead
    implements UseCase<Set<String>, MarkAllReadParams> {
  MarkAllNotificationsRead(this._repository);

  final NotificationRepository _repository;

  @override
  Future<Either<Failure, Set<String>>> call(MarkAllReadParams params) =>
      _repository.markAllRead(params.ids);
}

class MarkAllReadParams extends Equatable {
  const MarkAllReadParams(this.ids);

  final List<String> ids;

  @override
  List<Object?> get props => [ids];
}
