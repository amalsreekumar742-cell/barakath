import 'package:firebase_core/firebase_core.dart';

import '../../firebase_options.dart';

/// Firebase initialization for the Barakath app.
///
/// WHY a dedicated init step: Firebase must be initialized once, before runApp. It is wired to the
/// generated [DefaultFirebaseOptions] (from `flutterfire configure` for project `barakath-e6ad3`), so
/// initialization is explicit and platform-correct on Android/iOS. The native config files
/// (`android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`) back this and are
/// per-project setup artifacts (not committed here).
class FirebaseConfig {
  FirebaseConfig._();

  static Future<void> init() async {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  }
}
