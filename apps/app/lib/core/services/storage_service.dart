import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:injectable/injectable.dart';

/// Firebase Storage paths (spec §4.22) with ONE deliberate override.
///
/// Profile photos live under `users/{uid}/profile`, NOT the spec's
/// `customers/{customerId}/profile`, so Storage matches the Firestore
/// collection — which is `users` throughout this project. Every other §4.22
/// path is unchanged.
class StoragePaths {
  const StoragePaths._();

  static String categoryImage(String categoryId) =>
      'categories/$categoryId/image';

  static String productImage(String productId, int imageIndex) =>
      'products/$productId/$imageIndex';

  static String bannerImage(String bannerId) => 'banners/$bannerId/image';

  static String reviewPhoto(String reviewId, int photoIndex) =>
      'reviews/$reviewId/$photoIndex';

  static String replacementPhoto(String requestId, int photoIndex) =>
      'replacements/$requestId/$photoIndex';

  /// OVERRIDES spec §4.22 `customers/{customerId}/profile`.
  static String profilePhoto(String uid) => 'users/$uid/profile';

  /// Prefix form, for callers that append their own index.
  static String reviewPrefix(String reviewId) => 'reviews/$reviewId';
  static String replacementPrefix(String requestId) =>
      'replacements/$requestId';
}

/// Uploads image files and returns their download URLs.
///
/// WHY the caller passes a prefix rather than a full path: §4.22 indexes photos
/// (`reviews/{reviewId}/{photoIndex}`), and the index depends on position in
/// the batch — which only this class knows while iterating.
///
/// WHY uploads are sequential and not `Future.wait`: a replacement request may
/// carry five photos from a phone camera on a weak connection. Five concurrent
/// multi-megabyte uploads is how you get a timeout on all five instead of a
/// slow success.
@lazySingleton
class StorageService {
  StorageService(this._storage);

  final FirebaseStorage _storage;

  /// Uploads [files] to `{pathPrefix}/{index}` and returns the download URLs in
  /// the same order. An empty list in gives an empty list out — no round trip.
  Future<List<String>> uploadImages(
    List<File> files,
    String pathPrefix, {
    int startIndex = 0,
  }) async {
    if (files.isEmpty) return const [];

    final urls = <String>[];
    for (var i = 0; i < files.length; i++) {
      final ref = _storage.ref('$pathPrefix/${startIndex + i}');
      await ref.putFile(files[i]);
      urls.add(await ref.getDownloadURL());
    }
    return urls;
  }

  /// Uploads a single file to an exact path (no index appended). Used for the
  /// one-per-entity images: profile photo, category image, banner.
  Future<String> uploadImage(File file, String path) async {
    final ref = _storage.ref(path);
    await ref.putFile(file);
    return ref.getDownloadURL();
  }

  /// Deletes by download URL. Never throws — a failed cleanup must not fail the
  /// user's action; the object is simply orphaned.
  Future<void> deleteByUrl(String url) async {
    try {
      await _storage.refFromURL(url).delete();
    } catch (_) {
      // Already gone, or not ours. Nothing useful to do.
    }
  }
}
