/// Pulls the 11-character video id out of any YouTube link an admin might
/// paste.
///
/// WHY this exists instead of `YoutubePlayer.convertUrlToId`: that helper
/// anchors every pattern to `^https://…$` and requires `v=` to be the FIRST
/// query parameter, so it returns null — and the video silently disappears —
/// for links people actually paste:
///
///   http://youtu.be/ID                    (not https)
///   youtu.be/ID                           (no scheme, as copied from a chat)
///   youtube.com/watch?app=desktop&v=ID    (v= is not first)
///   youtube.com/live/ID                   (not handled at all)
///
/// The admin form only checks the host, so all of these save fine and then
/// render nothing. This matches the extractor the customer website already
/// uses (`apps/web` → `YoutubeEmbed.extractYoutubeId`).
class YoutubeUrl {
  const YoutubeUrl._();

  /// Ordered by specificity; the first hit wins. Host and path are matched
  /// loosely (no scheme anchor) because the id itself is the strong signal.
  static final List<RegExp> _patterns = [
    RegExp(r'youtube\.com/watch\?(?:[^\s]*&)?v=([\w-]{11})'),
    RegExp(r'youtube(?:-nocookie)?\.com/embed/([\w-]{11})'),
    RegExp(r'youtube\.com/shorts/([\w-]{11})'),
    RegExp(r'youtube\.com/live/([\w-]{11})'),
    RegExp(r'youtube\.com/v/([\w-]{11})'),
    RegExp(r'youtu\.be/([\w-]{11})'),
  ];

  /// A bare id pasted on its own, e.g. `dQw4w9WgXcQ`.
  static final RegExp _bareId = RegExp(r'^[\w-]{11}$');

  /// The video id, or null when [url] carries no recognisable one.
  static String? extractId(String url) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return null;
    if (_bareId.hasMatch(trimmed)) return trimmed;

    for (final pattern in _patterns) {
      final match = pattern.firstMatch(trimmed);
      if (match != null) return match.group(1);
    }
    return null;
  }
}
