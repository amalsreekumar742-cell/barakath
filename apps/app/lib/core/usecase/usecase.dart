import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../error/failures.dart';

/// Base contract for every use case (one business action = one class).
///
/// A use case takes [Params] and returns `Either<Failure, Type>` — `Left` on
/// failure, `Right` on success. The presentation layer calls `usecase(params)`
/// and `.fold`s the result; it never touches repositories or datasources.
abstract class UseCase<T, Params> {
  Future<Either<Failure, T>> call(Params params);
}

/// A synchronous / fire-and-forget use case that doesn't return a Future
/// (e.g. a local, in-memory action). Still returns `Either` for uniformity.
abstract class SyncUseCase<T, Params> {
  Either<Failure, T> call(Params params);
}

/// Marker for use cases that take no arguments — pass `NoParams()`.
class NoParams extends Equatable {
  const NoParams();

  @override
  List<Object?> get props => [];
}
