import 'package:equatable/equatable.dart';

/// One customer-facing policy page (Privacy Policy, Terms & Conditions,
/// Refund, Shipping…) from `policies/{id}`, managed in admin Settings ›
/// Policies.
///
/// WHY no `status` field: the app can only ever read ENABLED policies — the
/// Firestore rules refuse a disabled one — so every [Policy] that reaches the
/// domain is by construction one the customer may see. Carrying a status the
/// UI could never observe as anything but "enabled" would invite dead branches.
class Policy extends Equatable {
  const Policy({
    required this.id,
    required this.name,
    required this.content,
    required this.order,
    required this.updatedAt,
  });

  final String id;

  /// Display name — the list row label and the detail page title.
  final String name;

  /// Rich-text HTML authored in the admin's React Quill editor. Rendered in a
  /// script-disabled WebView (`HtmlContentView`), never parsed in Dart.
  final String content;

  /// 1-based display position chosen by the admin; lists sort ascending.
  final int order;

  final DateTime? updatedAt;

  @override
  List<Object?> get props => [id, name, content, order, updatedAt];
}
