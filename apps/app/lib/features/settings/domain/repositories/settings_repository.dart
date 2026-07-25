import 'package:dartz/dartz.dart';

import '../../../../core/error/failures.dart';
import '../entities/general_settings.dart';

/// Domain contract for reading app-wide settings. Implemented in the data layer.
abstract class SettingsRepository {
  /// The single `general/config` document, or a [Failure] on the `Left`.
  Future<Either<Failure, GeneralSettings>> getSettings();
}
