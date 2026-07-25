import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';

import 'injection_container.config.dart';

/// The single service locator. Datasources, repositories, use cases and
/// providers are pulled via `sl<T>()` — never instantiated directly in widgets.
final GetIt sl = GetIt.instance;

/// Wire up every `@injectable`/`@LazySingleton` class. The implementation is
/// generated into `injection_container.config.dart` by:
///   dart run build_runner build --delete-conflicting-outputs
/// Call once in `main()` before `runApp()`.
@InjectableInit(
  initializerName: 'init',
  preferRelativeImports: true,
  asExtension: true,
)
Future<void> configureDependencies() async => sl.init();
