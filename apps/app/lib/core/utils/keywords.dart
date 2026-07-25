/// Prefix-keyword builder for Firestore search arrays (spec §4.23).
///
/// Firestore has no substring search, so every searchable document carries a
/// `keywords` array of lower-cased prefixes that an `array-contains` query can
/// hit. This is the ONE implementation — `features/auth`'s datasource still has
/// a private copy from Batch 1; new code must use this.
///
/// WHY prefixes and not tokens: the admin's customer search is type-ahead, so
/// "mi" has to match "Mira" before the whole word is typed.
List<String> buildKeywords(Iterable<String?> parts) {
  final set = <String>{};

  for (final raw in parts) {
    final value = (raw ?? '').trim().toLowerCase();
    if (value.isEmpty) continue;

    // An email or a phone number is searched whole, and by its local part —
    // splitting "a@b.com" on whitespace would produce one useless token.
    set.add(value);

    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length >= 4) {
      set.add(digits);
      // Trailing fragments: staff search by the last few digits of a number.
      for (var i = digits.length - 4; i > 0; i--) {
        set.add(digits.substring(i));
      }
    }

    for (final word in value.split(RegExp(r'[\s@._-]+'))) {
      if (word.isEmpty) continue;
      for (var i = 1; i <= word.length; i++) {
        set.add(word.substring(0, i));
      }
    }
  }

  // Firestore caps an array at 20 000 entries and charges an index write per
  // entry; a long name plus an email is nowhere near that, but bound it anyway
  // so a pasted paragraph can't blow up the document.
  return set.take(500).toList(growable: false);
}
