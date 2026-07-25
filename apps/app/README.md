# Barakath — Customer App (Flutter)

The customer mobile app for Barakath. Dart/Flutter — **not** part of the pnpm/JS workspace.

## Architecture

Feature-based structure with Provider for state and go_router for navigation:

```
lib/
  main.dart
  core/
    constants/    app_constants.dart (APP_NAME, PAGE_SIZE, country code, ₹)
    config/       firebase_config.dart (Firebase init)
    theme/        app_theme.dart (brand colors, Material theme)
    routes/       app_router.dart (go_router config)
  features/
    <feature>/
      data/                    datasources / models / repositories
      presentation/screens/    screens
      presentation/widgets/    feature widgets
      providers/               ChangeNotifier state
  shared/
    models/       shared domain models
    widgets/      shared UI components
    services/     Firebase / Razorpay / MSG91 service wrappers
assets/
  images/  icons/  fonts/
```

## Setup

```bash
cd apps/app
cp .env.example .env          # optional runtime config
flutter pub get

# Generate native platform projects (android/ ios/ are committed as placeholders):
flutter create --platforms=android,ios .

# Wire Firebase (generates lib/firebase_options.dart):
flutterfire configure

flutter run
```

## Notes

- **Payments:** Razorpay (`razorpay_flutter`).
- **OTP:** MSG91 (via a backend Cloud Function; the app calls the function, never MSG91 directly).
- **Currency:** ₹ INR. **Language:** English only.
- Every Firestore list is cursor-paginated (`limit` + `startAfterDocument`); page size default 12
  (`AppConstants.pageSize`). Sums/counts use aggregation queries — never client-side loops.
