import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/general_settings.dart';
import '../repositories/settings_repository.dart';

/// Fetch the single `general/config` settings document.
@injectable
class GetGeneralSettings implements UseCase<GeneralSettings, NoParams> {
  GetGeneralSettings(this._repository);

  final SettingsRepository _repository;

  @override
  Future<Either<Failure, GeneralSettings>> call(NoParams params) =>
      _repository.getSettings();
}
