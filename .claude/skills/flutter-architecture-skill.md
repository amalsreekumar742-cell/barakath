---
name: flutter-architecture-rules
description: Use when writing or reviewing Flutter code, setting up Clean Architecture folder structures, implementing state management with Provider, or wiring Firestore repositories using dartz and injectable.
---


# Flutter Clean Architecture — Claude Skill Rules

> **Scope note:** Everything in this document (clean architecture layers, Provider, get_it/injectable, dartz, the specific packages listed) is **Flutter-specific guidance**. It applies whenever an app in this monorepo (`user_app`, `admin_app`, or any future app) is built with Flutter. If a different stack is chosen for an app (see "Multi-App Monorepo Structure" → always ask in chat first), this Flutter doc's architecture rules do NOT get force-fitted onto that stack — instead, follow that stack's own idiomatic, well-established architecture and best practices (e.g. a React/Next.js admin app should follow standard React/Next.js project conventions, not a Dart clean-architecture folder structure).

## Project Context
- **Framework:** Flutter
- **Architecture:** Clean Architecture (Reso Coder style), feature-based folder structure
- **State Management:** Provider (package: `provider`)
- **Backend:** Firebase (Auth, Firestore, Storage, Cloud Functions as applicable)
- **DI:** get_it + injectable (annotation-based service locator, code-generated)
- **Functional/Error handling:** dartz (`Either<Failure, T>`)

---


## Folder Structure (Feature-based, Reso Coder Clean Architecture)

```
lib/
├── core/
│   ├── constants/           # AppIcons, AppImages, AppLottie, AppColors, AppFonts (asset & design-token references)
│   ├── error/              # Failure, Exception classes
│   ├── usecase/            # Base UseCase abstract class
│   ├── network/             # NetworkInfo, connectivity checks
│   ├── utils/               # Constants, helpers, extensions
│   ├── widgets/             # Shared/reusable widgets
│   └── di/                  # get_it + injectable setup (injection_container.dart, injection_container.config.dart)
│
├── features/
│   └── feature_name/
│       ├── data/
│       │   ├── datasources/      # Remote (Firebase) & local datasources
│       │   ├── models/           # Data models (extends entity, fromJson/toJson)
│       │   └── repositories/     # RepositoryImpl
│       ├── domain/
│       │   ├── entities/         # Pure business objects
│       │   ├── repositories/     # Abstract repository contracts
│       │   └── usecases/         # Single-responsibility use case classes
│       └── presentation/
│           ├── providers/              # ChangeNotifier classes (state)
│           ├── pages/                  # Screens
│           └── widgets/                # Feature-specific widgets
│
└── main.dart
```

---

## Layer Rules

### Domain Layer (innermost, no dependencies on other layers)
- Contains **entities**, **repository abstracts**, **usecases** only.
- No Flutter imports, no Firebase imports, no external packages except `dartz`/`equatable`.
- Each usecase = one class with a single `call()` method.

### Data Layer
- **Models** extend domain **entities** and implement `fromJson`, `toJson`, `fromFirestore` etc.
- **Datasources** talk directly to Firebase (FirebaseAuth, FirebaseFirestore, FirebaseStorage). No business logic here, only data fetch/push.
- **RepositoryImpl** implements the domain repository contract, handles try/catch around datasource calls, converts exceptions to `Failure` objects, returns `Either<Failure, T>` (using `dartz`).

### Presentation Layer
- Only this layer should know about Flutter widgets/UI.
- State management (Provider — `ChangeNotifier` + `ChangeNotifierProvider`/`Consumer`) calls **usecases**, never datasources or Firebase directly.
- Pages/widgets listen to state, never contain business logic.

---

## Firebase-Specific Rules
- All Firebase calls (Auth, Firestore, Storage, FCM) must live inside `data/datasources/`, never inside UI or domain.
- Wrap every Firebase call in try/catch and convert `FirebaseException` → custom app `Exception` → `Failure` in repository.
- Use `.withConverter()` or model `fromMap/toMap` for Firestore documents — avoid raw `Map<String, dynamic>` in presentation layer.
- Keep Firestore collection/field name strings as constants in `core/constants/firebase_collections.dart` (see "Assets & Design Constants" section below for the full `core/constants/` pattern).
- **Mandatory pagination/lazy loading:** any Firestore query that returns a list (collection query) MUST use lazy loading / pagination — never fetch an entire collection in one go.
  - Use Firestore's `Query.limit(pageSize)` + `startAfterDocument(lastDocumentSnapshot)` (cursor-based pagination), not `offset`-based pagination.
  - Datasource method signature should accept a page size and the last fetched `DocumentSnapshot` (or a cursor value), and return both the new items and the new last-document cursor, e.g. `Future<PaginatedResult<T>> getItems({required int limit, DocumentSnapshot? startAfter})`.
  - Repository/usecase layer passes this cursor through unchanged — domain entities should not depend on Firestore's `DocumentSnapshot` type directly; wrap it in a generic cursor/pagination model in `core/` (e.g. `PaginatedResult<T>` holding `items`, `nextCursor`, `hasMore`).
  - Presentation layer (Provider + `ChangeNotifier`) triggers the next page fetch on scroll-to-bottom (e.g. via `ScrollController` listener or a paginated `ListView.builder`), appends new items to existing state, and tracks `isLoadingMore` / `hasMore` flags to avoid duplicate fetches.
  - Default page size: **10–15 items**, adjusted by list-item complexity/size — keep each screen's page size as a named constant in `core/utils/constants.dart`.
    - **Heavy/large items** (multi-line cards with images, detailed employee cards, invoice rows with nested data): use the lower end — **10 items per page** — to reduce payload size, memory usage, and initial render time.
    - **Light/small items** (single-line text rows, simple name lists, tag/chip lists): use the upper end — **15 items per page** — since each item is cheap to fetch and render.
    - **Medium items** (two-line list tiles, compact cards without images): use **12–13 items per page** as a balanced default.
    - When creating a new paginated screen, Claude should assess the item widget's visual size and data weight, then pick an appropriate page size from the 10–15 range — don't blindly use the same number everywhere.
  - Never use `.get()` on an unbounded query (no `.limit()`) for any list-rendering screen — this is a hard rule, not a suggestion.
- **Mandatory aggregation queries for sum/count/average:** whenever a screen needs a sum, count, or average over a Firestore collection/query (e.g. total salary, total hours, employee count, total amount), MUST use Firestore's [Aggregation Queries](https://firebase.google.com/docs/firestore/query-data/aggregation-queries) (`count()`, `sum()`, `average()`) — **never** fetch the full set of documents and compute the total client-side in Dart.
  - Why: aggregation queries are computed server-side and only the single summary value is transmitted back — this is billed as a small, fixed number of "index entries scanned" rather than one document read per document, which keeps Firestore billing minimal compared to reading every document just to sum a field in the app.
  - Dart usage pattern:
    ```dart
    // Count — e.g. total number of active employees
    final countSnapshot = await FirebaseFirestore.instance
        .collection(FirebaseCollections.users)
        .where('status', isEqualTo: 'active')
        .count()
        .get();
    final activeEmployeeCount = countSnapshot.count;

    // Sum — e.g. total payroll amount for a period
    final sumSnapshot = await FirebaseFirestore.instance
        .collection(FirebaseCollections.payroll)
        .where('month', isEqualTo: selectedMonth)
        .aggregate(sum('netSalary'))
        .get();
    final totalPayroll = sumSnapshot.getSum('netSalary');

    // Average — e.g. average working hours
    final avgSnapshot = await FirebaseFirestore.instance
        .collection(FirebaseCollections.attendance)
        .aggregate(average('hoursWorked'))
        .get();
    final avgHours = avgSnapshot.getAverage('hoursWorked');
    ```
  - Keep these aggregation calls inside `data/datasources/`, exposed through the repository/usecase as a plain `int`/`double` result (e.g. `GetTotalPayroll`, `GetActiveEmployeeCount` usecases) — same layering as any other Firestore read in this doc.
  - This applies to dashboards, summary cards, totals shown in lists, reports, etc. — any place a number is "all X added/counted/averaged up," reach for aggregation queries first, never a manual loop over fetched documents.

---

## Dependency Injection — get_it + injectable
- `GetIt` instance is the single service locator, exposed as `sl` (or `getIt`) in `core/di/injection_container.dart`.
- Use `injectable` annotations instead of manual `sl.registerLazySingleton(...)` calls:
  - `@LazySingleton(as: XxxRepository)` on `RepositoryImpl` classes.
  - `@injectable` on UseCase classes and datasource implementations.
  - `@module` classes for third-party instances that can't be annotated directly (e.g. `FirebaseAuth.instance`, `FirebaseFirestore.instance`, `FirebaseStorage.instance`).
- Run `flutter pub run build_runner build --delete-conflicting-outputs` after adding/changing `@injectable`/`@LazySingleton` classes to regenerate `injection_container.config.dart`.
- Call `configureDependencies()` (generated by injectable) once in `main()` before `runApp()`.
- Presentation layer should fetch usecases/providers via `sl<T>()` (or constructor-inject them) — never instantiate repository/datasource classes directly in widgets.
- Provider registration in the widget tree (`ChangeNotifierProvider`) should pull the `ChangeNotifier` instance via `sl<XxxProvider>()` if it's also injectable, or construct it passing in injected usecases.

---

## dartz Usage
- Reference: https://pub.dev/packages/dartz
- Use `Either<Failure, T>` as the return type for every repository method and usecase `call()`.
- Convention: `Left` = failure/error, `Right` = success value.
- Always handle both sides explicitly with `.fold(onFailure, onSuccess)` in the calling provider — never unwrap with `.getOrElse` casually in a way that silently swallows errors.
- Don't mix `Either` with `try/catch` leaking into the presentation layer — exceptions must be converted to `Failure` and wrapped in `Left` inside the repository implementation, before reaching usecases/providers.
- Keep `Failure` subclasses (e.g. `ServerFailure`, `CacheFailure`, `NetworkFailure`) in `core/error/failures.dart`, and matching `Exception` subclasses in `core/error/exceptions.dart`.

---

## Package-First Policy (Use Existing Package vs. Build from Scratch)

**Rule:** Before writing custom/from-scratch code for any common feature, first check if a simple, lightweight ("easy_*" style) package already does the job. Only build from scratch if no suitable package exists or fits the use case.

Order of preference for any feature:
1. Check if the project already has a package for this in `pubspec.yaml` — reuse it.
2. If not, check if a simple/easy pub.dev package exists for this exact need (prefer the ones below where applicable).
3. Only if no simple package fits → build the feature from scratch (custom widget/service/animation).

### Pre-approved simple packages for common features
- **Push Notifications / FCM:** [`easy_fcm`](https://pub.dev/packages/easy_fcm) — wraps `firebase_messaging` + `flutter_local_notifications`, handles foreground/background/terminated states with one `initialize()` call and a single `onTap` callback. Use instead of wiring `firebase_messaging` + local notifications manually.
- **No Internet / Connectivity Screen:** [`dash_no_internet_screen`](https://pub.dev/packages/dash_no_internet_screen) — wrap any screen with `DashNoInterNetScreen` to auto-show a "no internet" UI (via `connectivity_plus`) with retry button and customizable text/image. Use instead of building a custom connectivity listener + UI from scratch.
- **URL/Call/SMS/Email/WhatsApp Launching:** [`easy_url_launcher`](https://pub.dev/packages/easy_url_launcher) — wraps `url_launcher` with simple static methods: `EasyLauncher.call()`, `.sms()`, `.email()`, `.url()`, `.openMap()`, `.sendToWhatsApp()`. Use instead of constructing `Uri`/`launchUrl` calls manually each time.
- **Animations:** Before hand-rolling `AnimationController`/`Tween` boilerplate, check for an existing simple animation package (e.g. `animate_do`, `flutter_animate`, `lottie` for complex/designed animations) that covers the needed effect. Only build a custom `AnimationController`-based animation if no package covers the specific effect needed.
- **Loading State (data fetch):** mandatory — see "Loading State Policy" below.
- **App Update / Force Update Prompt:** [`upgrader`](https://pub.dev/packages/upgrader) — `UpgradeAlert`/`UpgradeCard` widgets for prompting users to update, with ignore/later/update-now buttons and built-in localization. **Version source must be Firestore-driven for this project, not the default store-scraping** — see "App Update / Version Check Policy" below.
- **Routing/Navigation (Flutter Web specifically):** [`go_router`](https://pub.dev/packages/go_router) — use for any Flutter app that targets web (URL-based routing, deep linking, browser back/forward support). For mobile-only Flutter apps, a simpler `Navigator`-based or named-route setup is fine; reach for `go_router` once web is a target platform, or if the app needs nested/shell routes and URL-driven navigation regardless of platform.

### When generating code, Claude should also:
- For any new feature request matching FCM, no-internet screen, url/call/sms/email/WhatsApp launching, animations, or similar common needs — first suggest/use the matching package above (or check if an equivalent is already in `pubspec.yaml`) instead of writing it from scratch.
- Keep package-based integrations inside the correct clean-architecture layer — e.g. `easy_fcm` initialization belongs in `core/` or a `notifications` feature's `data/datasources/`, not directly in UI code; `easy_url_launcher` calls can be used directly from presentation widgets since they involve no business logic.
- If a pre-approved package genuinely doesn't fit the requirement, briefly explain why before falling back to a custom/scratch implementation.
- Always verify the package is still current on pub.dev and add it to `pubspec.yaml` with the correct version before using it in generated code.

---

## Loading State Policy (Mandatory)

**Rule:** Whenever data is being fetched (Firestore queries, API calls, pagination "load more", etc.), the UI MUST show a proper loading placeholder using one of these packages — never a bare blank screen, and avoid a plain centered `CircularProgressIndicator` for list/content screens.

- **[`skeletonizer`](https://pub.dev/packages/skeletonizer)** — preferred for list/grid/detail screens with a known layout shape. Wrap the real (already-built) widget tree with `Skeletonizer(enabled: isLoading, child: ...)`; it auto-converts the real layout into a skeleton with a shimmer effect, so the skeleton never goes out of sync with the actual UI. Use fake/placeholder data (`BoneMock` or `List.filled`) to give the layout something to shape while `isLoading` is true.
- **[`shimmer`](https://pub.dev/packages/shimmer)** — use for simpler custom placeholder shapes (e.g. a single banner/avatar/card skeleton not tied to a full widget tree), wrapping a `Container`/`Box` UI with `Shimmer.fromColors(baseColor: ..., highlightColor: ..., child: ...)`.

### Usage rules
- Initial load (first page / first fetch): show full-screen skeleton (`skeletonizer`) matching the real layout shape.
- Pagination "load more" (see Mandatory Pagination rule): show a small shimmer/skeleton loader at the bottom of the list while `isLoadingMore` is true — not a full-screen loader.
- Single-item / detail screens: wrap the content widgets in `Skeletonizer(enabled: isLoading, ...)` using mock data matching the entity shape.
- Don't mix both packages for the same loading state — pick `skeletonizer` by default; only fall back to `shimmer` for simple custom shapes that don't map cleanly to a real widget tree.
- Loading/error/data state must come from the Provider (`ChangeNotifier`) as an explicit, named state (e.g. `ViewState.loading/error/loaded/loadingMore`) — never inferred from null-checks alone.

---

## App Update / Version Check Policy

**Rule:** Use [`upgrader`](https://pub.dev/packages/upgrader) for the force-update / "update available" UI (`UpgradeAlert`/`UpgradeCard`), but the **source of the version data is Firestore (a config document), NOT the default Play Store/App Store scraping that `upgrader` does out of the box.** Don't rely on `upgrader`'s default `UpgraderPlayStore`/`UpgraderAppStore` behavior for the actual version check.

### Why
- `upgrader`'s default store-check scrapes the public Play Store/App Store listing pages — this breaks for apps in closed/internal testing tracks, and isn't reliable for an internal/B2B app like this where the team wants to control rollout from one place (Firestore) rather than store metadata.
- Driving the check from Firestore lets the team instantly force/soften an update requirement from a backend doc, without waiting on a store listing to propagate.

### Implementation pattern
- Keep a config document in Firestore, e.g. `app_config/{platform}` or `app_config/version`, with fields like `latestVersion`, `minSupportedVersion`, `forceUpdate` (bool), `releaseNotes`.
- In `core/` (e.g. `core/services/app_version_datasource.dart`), fetch this doc once at app start (and optionally cache it).
- Feed the fetched `minSupportedVersion`/`latestVersion` into `Upgrader`'s `minAppVersion` parameter (or a custom `UpgraderStore` subclass if you want full control over `isUpdateAvailable`/release notes logic) — this overrides `upgrader`'s default store-scraping path.
- Wrap the app's root widget in `UpgradeAlert` (below `MaterialApp`), passing the configured `Upgrader` instance with the Firestore-sourced version info, so the existing alert/card UI, ignore/later/update-now buttons, and localization from `upgrader` are reused as-is.
- This keeps version-check logic inside `core/` (cross-cutting, not feature-specific), following the same datasource pattern as other Firebase reads in this doc.

### Mandatory check-in
**Before implementing this, Claude must ask in chat which version-check connection to use for the current project:**
1. **Firestore-based (recommended default for this setup)** — version data comes from a Firestore config doc, as described above.
2. **Store-based (`upgrader` default)** — version data comes from scraping the live Play Store/App Store listing.

Don't silently assume one or the other; confirm with the user first, since this changes what needs to be configured (a Firestore doc + datasource vs. relying on store metadata text like `[Minimum supported app version: 1.2.3]` in the store listing description).

---

## Git Commit Policy (Mandatory per Feature)

**Rule:** Every completed feature MUST go through a strict **Build → E2E Test → Commit → Push** cycle before Claude proceeds to the next feature. Never skip testing, and never start new work on top of untested or un-pushed code.

### Mandatory feature completion flow
```
Feature code complete
       ↓
   flutter build (compile check)
       ↓
   E2E test (integration_test/)
       ↓
   ✅ Pass → git add + commit + push
       ↓
   Next feature
       
   ❌ Fail → fix → re-test → then commit + push
```

### Why
- Prevents loss of working code if something breaks during the next feature.
- Keeps the git history clean, reviewable, and bisectable — each commit represents one coherent, tested, working change.
- Makes rollbacks trivial — if a new feature introduces a bug, the team can revert to the last pushed commit without untangling interleaved changes.
- E2E testing before commit ensures no broken feature ever enters the repository — bugs are caught at the source, not downstream.
- Forces a natural checkpoint where the developer (and AI) can verify the feature actually works before moving forward.

### E2E Testing Rules
1. **After completing a feature's code** (all layers — domain, data, presentation — wired up), Claude must write or update an end-to-end integration test before committing.
2. **Test file location:** `integration_test/features/<feature_name>_test.dart` — mirror the `lib/features/` structure.
3. **What to test (minimum per feature):**
   - **Screen renders correctly** — key widgets are present (buttons, text fields, list items, headers).
   - **Happy path works** — the primary user flow completes successfully (e.g. tap button → data loads → list shows items; fill form → submit → success state).
   - **Error/empty states** — the screen handles failure gracefully (e.g. network error shows error UI, empty list shows empty state).
   - **Pagination (if applicable)** — initial page loads, scroll-to-bottom triggers next page, "load more" skeleton appears.
   - **Navigation** — tapping an item navigates to the correct detail screen; back button works.
4. **Use Flutter's `integration_test` package** — not unit tests or widget tests (those are separate and optional). E2E tests run the full app with real or mocked Firebase.
5. **Firebase mocking in tests:** use `fake_cloud_firestore` or a dedicated Firebase emulator setup. Never run E2E tests against production Firestore.
6. **Run the test before committing:**
   ```bash
   flutter test integration_test/features/<feature_name>_test.dart
   ```
   If the test fails, fix the code, re-run — do NOT commit until the test passes.
7. **Existing tests must still pass.** Before committing, run the full E2E suite to catch regressions:
   ```bash
   flutter test integration_test/
   ```
   If a new feature breaks an existing test, fix the regression before committing.
8. **Test naming convention:** `<feature_name>_test.dart`, test group names describe the screen/flow, individual test names describe the behaviour:
   ```dart
   // integration_test/features/attendance_list_test.dart
   group('Attendance list screen', () {
     testWidgets('loads first page with skeleton then shows employee cards', (tester) async { ... });
     testWidgets('scrolling to bottom loads next page', (tester) async { ... });
     testWidgets('shows error state when network fails', (tester) async { ... });
   });
   ```
9. **Claude must generate the test file as part of the feature** — not as a separate follow-up task. The test is part of the feature, not an afterthought.

### Git Commit Rules
1. **After all tests pass**, Claude must run:
   ```bash
   git add .
   git commit -m "feat(<feature_name>): <short description>"
   git push origin <current_branch>
   ```
2. **Commit message format:** follow [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:` etc. Include the feature/module name in parentheses, e.g. `feat(attendance): add paginated employee list with skeleton loading`.
3. **Do NOT batch multiple features into one commit.** Each feature gets its own test-commit-push cycle. If a feature spans multiple sub-tasks (e.g. domain layer → data layer → presentation layer), those sub-tasks can be one commit together (since they form one coherent feature), but two separate features must never share a commit.
4. **Do NOT proceed to the next feature's code until the push succeeds.** If the push fails (network error, merge conflict, etc.), resolve it first — don't start writing new feature code on top of an un-pushed state.
5. **Claude must explicitly tell the user** when it's time to test, commit, and push, and either run the commands directly (if terminal access is available) or prompt the user to do so before continuing.
6. **Bug fixes and refactors also get their own test-commit-push cycle** — not just new features. Any working change = test + commit + push before next task.

### What counts as a "completed feature"
- A new screen/page with its full clean-architecture stack (entity → usecase → repository → datasource → provider → page) **plus its E2E test**.
- A new piece of functionality added to an existing screen (e.g. adding a filter, a new button action, a new API integration) **plus updated/new E2E test**.
- A bug fix that changes behaviour **plus a test that verifies the fix**.
- A refactor that restructures code without changing behaviour — existing tests must still pass.
- Adding/updating Firestore security rules, indexes, or Cloud Functions.

### What does NOT count (don't commit mid-work)
- A half-wired feature where the domain layer exists but presentation doesn't — this is not yet a working unit.
- Generated files alone (e.g. running `build_runner` without the code that uses the generated output).
- Feature code without its E2E test — the test is part of the feature, not optional.

---

## Multi-App Monorepo Structure (Admin App + User App)

**Rule:** Both the **Admin app** and the **User app** are created inside a single root project folder (monorepo) — they are NOT split into separate repositories. Each app's tech stack is decided independently per project (Flutter, React/Next.js, etc.) — **before generating any code for a given app, Claude must ask in chat which stack that app should use**, rather than assuming Flutter by default.

```
project-root/
├── user_app/                    # End-user facing app — stack decided per project (ask first)
│   ├── (Flutter)  lib/, pubspec.yaml, ...
│   ├── (React)    src/, package.json, ...
│   └── ...
│
├── admin_app/                   # Admin/back-office app — stack decided per project (ask first)
│   ├── (Flutter)  lib/, pubspec.yaml, ...
│   ├── (React)    src/, package.json, ...
│   └── ...
│
├── firebase/                    # Firebase project config shared by both apps regardless of stack
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
│
└── README.md
```

### Rules
- Neither app has a stack assumed by default. **Claude must explicitly ask which stack to use for `user_app` and which stack to use for `admin_app`** (Flutter, React/Next.js, or other) before scaffolding/generating code for that app — don't default to Flutter just because this doc is Flutter-focused.
- There is **no `shared/` code folder** between the two apps. Since `admin_app` and `user_app` may run on two completely different stacks (e.g. Flutter + React), Dart/JS code cannot be shared or imported across them — don't try to wire one app's code into the other.
- If — and only if — both apps happen to be Flutter, shared Dart code (entities, constants, Firebase config) may be pulled into a local `shared/` path package at that point; this is the exception, not the default setup.
- Instead of code-sharing, keep the two apps in sync through the **data contract**: `firebase/firestore.rules` plus consistent Firestore collection/field naming is the single source of truth both stacks must code against, regardless of language/framework.
- Whichever stack `user_app` uses, if it is Flutter it still follows the Clean Architecture layering rules in this document; if it's a different stack, this doc's Flutter-specific rules (layers, Provider, get_it, dartz, etc.) simply don't apply to it and that app should follow its own stack's best practices instead.
- All apps connect to the **same Firebase project** regardless of stack (Flutter apps via `firebase_options.dart`/`flutterfire configure`; a JS app via the Firebase JS SDK config), so Firestore documents, collections, and field names must stay identical across whichever stacks read/write them.
- Security boundary between admin and user must be enforced server-side via **Firestore Security Rules** (`firebase/firestore.rules`) and/or **custom claims**, not just by which app/stack the user opens — never assume either app alone keeps data safe, especially important once apps run on separate stacks with separate auth flows.
- Keep one `firestore.rules`, one `firestore.indexes.json`, and one `storage.rules` at the `firebase/` root — shared by every app/stack in the monorepo.

---

## Naming Conventions
- Files: `snake_case.dart`
- Classes: `PascalCase`
- Usecases: verb-based, e.g. `GetUserProfile`, `LoginWithEmail`, `UploadFile`
- Repository interface: `xxx_repository.dart` (domain) vs `xxx_repository_impl.dart` (data)
- Providers: `xxx_provider.dart` (ChangeNotifier class, e.g. `AuthProvider`, `ProfileProvider`)
- Injectable modules: `xxx_module.dart` in `core/di/` for third-party/manual registrations

---

## Assets & Design Constants (`core/constants/`)

All static assets (icons, images, lottie files) and design tokens (colors, fonts) are referenced through dedicated static classes in `core/constants/` — never hardcode raw asset path strings or `Color(0xFF...)` / font-name strings directly inside widgets.

### Files in `core/constants/`
```
core/constants/
├── app_icons.dart           # AppIcons — static String paths for assets/.../icons/
├── app_images.dart          # AppImages — static String paths for assets/.../images/
├── app_lottie.dart          # AppLottie — static String paths for assets/.../lotties/
├── app_colors.dart          # AppColors — static Color design tokens
├── app_fonts.dart           # AppFonts — static String font family names
├── app_details.dart         # AppDetails — app identity, config values, third-party keys, external links
├── firebase_collections.dart # FirebaseCollections — Firestore collection name strings
└── cloud_function_urls.dart  # CloudFunctionUrls — deployed Cloud Function HTTPS endpoint URLs
```

### Pattern (per app — `admin_app` and `user_app` each have their own copies, pointing at their own `assets/` folder)

```dart
// core/constants/app_icons.dart
const adminBaseUrl = 'assets/admin/icons/';

class AppIcons {
  // --------------------- ADMIN ICONS --------------------- //
  static String addShift = '${adminBaseUrl}addShift.png';
}
```

```dart
// core/constants/app_images.dart
const adminBaseUrl = 'assets/admin/images/';

class AppImages {
  // ----------------- ADMIN IMAGES -----------------
  static String branchImage = '${adminBaseUrl}branchImage.png';
}
```

```dart
// core/constants/app_lottie.dart
const baseUrl = 'assets/admin/lotties/';

class AppLottie {
  static String splash = '${baseUrl}splash.json';
}
```

```dart
// core/constants/app_colors.dart
class AppColors {
  static Color primary = const Color(0xFF388E3C);
  static Color shortHours = const Color(0xFFFF8C00);
}
```

```dart
// core/constants/app_fonts.dart
class AppFonts {
  static String radioCanadaBig = "Radio Canada Big";
  static String inter = "Inter";
}
```

```dart
// core/constants/app_details.dart
// Single source of truth for app identity, config values, third-party keys,
// and external links — grouped by category with comment headers so it stays
// scannable as it grows.
class AppDetails {
  // --------------------- APP IDENTITY --------------------- //
  static const appName = "Totalx Attendance Payroll";
  static const packageName = "com.totalx.attendancepayroll";
  static const projectId = "totalx-payroll";

  // --------------------- FCM TOPICS --------------------- //
  static const userSubscribeTopic = 'users';
  static const adminSubscribeTopic = 'admin';
  static const allSubscribeTopic = 'all';

  // --------------------- DEFAULTS / THRESHOLDS --------------------- //
  static const initialCountryCodeSelection = '+91';
  static const minLocationAccuracy = 30.0;
  static const defaultLocationAccuracy = 100.0;
  static const maxLocationAccuracy = 1000.0;

  // --------------------- THIRD-PARTY API KEYS --------------------- //
  // Note: see "Secrets & API Keys" rule below — these should come from
  // --dart-define / env config in real builds, not be committed as literals.
  static const truecallerClientID = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  static const olaMapApiKey = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  // --------------------- STORE / SHARE LINKS --------------------- //
  static const appStoreAppId = '6748619904';
  static const String playStoreAppShareLink =
      "https://play.google.com/store/apps/details?id=$packageName";
  static const String appStoreAppShareLink =
      "https://apps.apple.com/in/app/$packageName/id$appStoreAppId";
  static const String appInviteLink = "https://app.payroll.totalx.io";
  static const String websiteLink = "https://payroll.totalx.io";

  // --------------------- COMPANY / INVOICE DETAILS --------------------- //
  static const String companyName = "Total- X";
  static const String companyAddress = "76JW+X5M, KL SH 39";
  static const String companyGSTIN = "32AAGFF8947B1ZK";
  static const String companyStateName = "Kerala";

  // --------------------- HELP / GUIDE VIDEO LINKS --------------------- //
  // Group multi-language or multi-section link sets together, named
  // consistently (e.g. ...Mlm / ...En / ...Hindi suffix per language).
  static const String helpFullVideoUrlEn = 'https://youtu.be/pWv2ia9Ujy8';
  static const String helpFullVideoUrlHindi = 'https://youtu.be/mu-i04woKOY';
}
```

```dart
// core/constants/firebase_collections.dart
// Single source of truth for Firestore collection names — used by every
// datasource instead of inlining raw collection-name strings.
class FirebaseCollections {
  static const String companies = 'companies';
  static const String users = 'users';
}
```

```dart
// core/constants/cloud_function_urls.dart
// Deployed Cloud Function HTTPS endpoint URLs, one constant per function.
class CloudFunctionUrls {
  // Base URL for cloud functions (use per-function constants below for
  // callable/HTTPS-triggered functions deployed individually)
  static const String baseUrl =
      'https://assignemployeetoshift-hyb2j7sw3a-uc.a.run.app';
}
```

### Matching `assets/` folder layout (at the Flutter project root, alongside `lib/`)
```
admin_app/
├── assets/
│   ├── icons/
│   │   └── addShift.png
│   ├── images/
│   │   └── branchImage.png
│   └── lotties/
│       └── splash.json
└── lib/
```
> Note: keep the base-url prefix (`assets/admin/...`) consistent with whatever you declare under `flutter: assets:` in `pubspec.yaml`. If `admin_app` and `user_app` are separate Flutter projects each with their own `assets/` folder, drop the `admin` segment in each app's own constants (e.g. just `assets/icons/`) unless you intentionally namespace per-app within a shared assets folder.

### Rules
- One static class per asset type (`AppIcons`, `AppImages`, `AppLottie`) plus one for colors (`AppColors`), fonts (`AppFonts`), general config/links (`AppDetails`), Firestore collection names (`FirebaseCollections`), and Cloud Function URLs (`CloudFunctionUrls`) — don't merge them into a single giant class.
- Group entries with a `// --------- SECTION ---------- //` comment when a class grows to cover multiple features/screens or categories (e.g. `// AUTH ICONS`, `// DASHBOARD ICONS`, `// FCM TOPICS`, `// STORE LINKS`), so it stays scannable.
- Widgets and pages must reference `AppIcons.xxx`, `AppImages.xxx`, `AppLottie.xxx`, `AppColors.xxx`, `AppFonts.xxx`, `AppDetails.xxx` — never inline `'assets/...'` strings, raw `Color(0xFF...)`/font-name strings, or magic config values/links/IDs directly inside `features/`.
- `AppColors`/`AppFonts` values should also be wired into the app's central `ThemeData` (in `core/theme/` or `main.dart`) rather than only used ad hoc per widget, so theme changes stay centralized.
- `AppDetails` holds app identity (name, package, project id), FCM topic names, numeric defaults/thresholds, third-party links (store/share/website), and company/invoice info — group related constants together with section-comment headers, and keep multi-language link sets (e.g. help videos) named with a consistent language suffix (`...En`, `...Hindi`, etc.).
- `FirebaseCollections` holds every Firestore collection name as a constant — datasources reference `FirebaseCollections.xxx` (e.g. `FirebaseFirestore.instance.collection(FirebaseCollections.users)`) instead of inlining `'users'`/`'companies'` string literals, so renaming a collection only requires a one-line change.
- `CloudFunctionUrls` holds deployed Cloud Function HTTPS endpoint URLs, one constant per function (add a new constant per function rather than reusing/string-concatenating off a shared `baseUrl` once you have more than one function, since each function typically gets its own unique Cloud Run URL). Datasources call these via `http`/`dio` from `data/datasources/`, never directly from presentation.
- **Secrets/API keys do NOT belong as plain literals in `AppDetails` (or any committed file).** Keys like `truecallerClientID`, map API keys, etc. should be injected via `--dart-define` / a `.env` file excluded from git / a secure config service, and only read into `AppDetails` (or a separate `AppSecrets` accessor) at build/runtime — never commit real key values to the repo.
- When generating any new icon/image/lottie/color/font/config/collection-name/function-URL usage, Claude should add the new entry to the relevant `core/constants/` class first, then reference it — never inline a literal path/value/link/key/collection-name in a widget or business logic.

---

## When generating code, Claude should:
1. Always place new code in the correct layer/folder per the structure above.
2. Never let UI call Firebase directly — always go through usecase → repository → datasource.
3. Use `Either<Failure, T>` (dartz) as the return type for repository and usecase methods.
4. Generate matching test stubs in `test/features/feature_name/...` mirroring the lib structure, when asked for tests.
5. Reuse `core/error/failures.dart` and `core/usecase/usecase.dart` base classes instead of redefining them per feature.
6. Ask before adding new external packages; prefer existing ones already in `pubspec.yaml`. For common needs (FCM, no-internet screen, url/call/sms launching, animations), prefer the pre-approved simple packages listed in "Package-First Policy" over building from scratch.
7. Keep each file focused — split widgets/usecases into separate files rather than combining unrelated logic.
8. For Provider state classes: extend `ChangeNotifier`, expose state via getters (not public fields), call `notifyListeners()` only after state changes, handle loading/error/data states explicitly (e.g. enum or separate bool/String fields).
9. Register providers using `MultiProvider` / `ChangeNotifierProvider` in `main.dart` or a dedicated `core/di/providers.dart`, not scattered across pages.
10. UI should read state with `context.watch<T>()` or `Consumer<T>`, and trigger actions with `context.read<T>()` — never call provider methods inside `build()` directly without `read`.
11. When generating new repository/usecase/datasource classes, add the correct `injectable` annotation (`@injectable`, `@LazySingleton(as: ...)`) and remind the user to run the build_runner command if it isn't run automatically.
12. Always return/propagate `Either<Failure, T>` from dartz through data → domain → presentation; never let raw exceptions reach the UI layer.
13. Any Firestore list/collection fetch must be paginated (cursor-based `limit()` + `startAfterDocument()`) — flag and refuse to generate an unbounded `.get()` on a collection for list screens; always implement with a `PaginatedResult<T>` cursor pattern and a paginated `ListView.builder`/scroll-listener on the presentation side.
14. Whenever generating a UI for a data-fetching screen, default to `skeletonizer` (full-screen skeleton on initial load, small skeleton/shimmer for "load more") instead of a bare `CircularProgressIndicator` or blank screen — use `shimmer` only for simple custom-shaped placeholders that don't fit a full widget skeleton.
15. Never hardcode an asset path string, raw `Color`/font-name, Firestore collection name, or Cloud Function URL inside a `features/` widget or datasource — add/reuse an entry in `core/constants/app_icons.dart` / `app_images.dart` / `app_lottie.dart` / `app_colors.dart` / `app_fonts.dart` / `firebase_collections.dart` / `cloud_function_urls.dart` and reference that instead.
16. Before scaffolding or generating code for `user_app` or `admin_app` for the first time, ask the user which stack that specific app should use (Flutter, React/Next.js, or other) — never assume Flutter by default just because this doc is Flutter-focused. Once confirmed, stick to that app's chosen stack for all subsequent generations unless told otherwise.
17. Never hardcode app identity values, FCM topic names, numeric defaults/thresholds, third-party API keys, store/share/website links, or company/invoice details inline in business logic — add/reuse an entry in `core/constants/app_details.dart` (`AppDetails`) instead, and flag any real secret/API key so it's moved to `--dart-define`/env config rather than committed as a literal.
18. Before implementing app-update/version-check logic, ask in chat whether the version source should be Firestore-based (recommended) or `upgrader`'s default store-scraping — never silently default to one. If Firestore-based, wire the fetched version doc into `Upgrader`'s `minAppVersion` (or a custom `UpgraderStore`) rather than letting `upgrader` hit the Play Store/App Store directly.
19. If a Flutter app targets web (or already uses `go_router`), use `go_router` for navigation instead of plain `Navigator`/named routes — needed for proper URL-based deep linking and browser back/forward support.
20. For any sum/count/average over a Firestore collection or query, always use Firestore Aggregation Queries (`.count()`, `.aggregate(sum(...))`, `.aggregate(average(...))`) — never fetch the full document set and total it up in Dart. This is a hard rule for keeping Firestore billing minimal; flag and refuse a client-side loop-and-sum approach over a fetched list when an aggregation query can do it server-side instead.
21. This entire document's rules (layers, Provider, get_it, dartz, package choices) apply only to apps confirmed to be on the **Flutter** stack. For any app confirmed to be on a different stack (React/Next.js, etc.), don't try to replicate this Flutter architecture — instead apply that stack's own standard, well-established architecture and conventions.
22. **Mandatory E2E test + git push per feature:** After completing any feature's code, Claude must (a) write/update an E2E integration test in `integration_test/features/`, (b) run and pass all tests, (c) commit and push to the remote — before proceeding to the next feature. The test is part of the feature, not optional. Never start implementing a new feature on top of untested or un-pushed work. Use Conventional Commits format (`feat(module): description`). See "Git Commit Policy" section above for full details.

---

## Notes
- This doc is set for **Provider** as the state management package. If the project later moves to Riverpod/Bloc, update the relevant sections.
- A starter `firestore.rules` file (role-based admin/user access, default-deny) is provided alongside this doc — place it at `firebase/firestore.rules` in the monorepo root and customize the example collections to match your actual data model.
- This file is meant to be used as a Claude Skill / Project Knowledge file so Claude follows this structure for every suggestion in this codebase.
