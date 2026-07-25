import 'dart:async';

import 'package:flutter/foundation.dart';

/// Collapses a burst of calls into a single trailing call.
///
/// WHY: search-as-you-type would otherwise fire one Firestore query per
/// keystroke — expensive in reads and prone to out-of-order results. Wrapping
/// the query in [run] means only the last keystroke of a burst reaches the
/// network.
class Debouncer {
  Debouncer({required this.milliseconds});

  final int milliseconds;
  Timer? _timer;

  /// Schedule [action], cancelling any call still waiting from a previous [run].
  void run(VoidCallback action) {
    _timer?.cancel();
    _timer = Timer(Duration(milliseconds: milliseconds), action);
  }

  /// Drop any pending call — must be invoked from the owner's `dispose()` so a
  /// late timer can't fire against a disposed widget/provider.
  void dispose() {
    _timer?.cancel();
    _timer = null;
  }
}
