import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';

/// Outcome of the avatar pick-and-crop pipeline. Exactly one of [file] and
/// [error] is non-null; both null means the customer backed out, which is not
/// an error and must not raise a toast.
class PhotoPickResult {
  const PhotoPickResult._({this.file, this.error});

  const PhotoPickResult.cancelled() : this._();
  const PhotoPickResult.picked(File file) : this._(file: file);
  const PhotoPickResult.failed(String error) : this._(error: error);

  final File? file;
  final String? error;
}

/// Image rules from spec §2.25 — max 2MB, JPG/PNG/WebP only.
const int _maxImageBytes = 2 * 1024 * 1024;
const Set<String> _allowedExtensions = {'jpg', 'jpeg', 'png', 'webp'};

/// Source sheet → picker → circular crop → validation.
///
/// WHY validation runs twice: the extension/size check on the ORIGINAL is what
/// enforces the spec's rule (a 40MB PNG is rejected before it is decoded), and
/// the re-check after cropping catches the rare case where the compressed JPEG
/// is still over the limit. Uploading is the caller's job — this only produces
/// a file it is safe to upload.
Future<PhotoPickResult> pickProfilePhoto(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppDimens.radiusXl)),
    ),
    builder: (ctx) => SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: AppDimens.space8),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Take a photo'),
            onTap: () => Navigator.pop(ctx, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Choose from gallery'),
            onTap: () => Navigator.pop(ctx, ImageSource.gallery),
          ),
          const SizedBox(height: AppDimens.space8),
        ],
      ),
    ),
  );
  if (source == null) return const PhotoPickResult.cancelled();

  try {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 90);
    if (picked == null) return const PhotoPickResult.cancelled();

    final extension = picked.path.split('.').last.toLowerCase();
    if (!_allowedExtensions.contains(extension)) {
      return const PhotoPickResult.failed(
        'Please choose a JPG, PNG or WebP image.',
      );
    }
    if (await File(picked.path).length() > _maxImageBytes) {
      return const PhotoPickResult.failed('Please choose an image under 2MB.');
    }

    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      // The cropper emits a compressed JPEG, so no separate compression step is
      // needed — quality 70 keeps an avatar well under the 2MB cap.
      compressQuality: 70,
      compressFormat: ImageCompressFormat.jpg,
      // Downscale rather than rely on quality alone: a square crop of a
      // high-megapixel photo can still clear 2MB at quality 70, and the Storage
      // rule then rejects it outright. The avatar is drawn at ~100px, so 1024 is
      // already far more than is needed. Keeps the size guard below unreached
      // for any realistic photo instead of refusing the customer's picture.
      maxWidth: 1024,
      maxHeight: 1024,
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Crop photo',
          toolbarColor: AppColors.brandGreenDark,
          toolbarWidgetColor: Colors.white,
          cropStyle: CropStyle.circle,
          hideBottomControls: true,
          lockAspectRatio: true,
        ),
        IOSUiSettings(
          title: 'Crop photo',
          cropStyle: CropStyle.circle,
          aspectRatioLockEnabled: true,
        ),
      ],
    );
    if (cropped == null) return const PhotoPickResult.cancelled();

    final file = File(cropped.path);
    if (await file.length() > _maxImageBytes) {
      return const PhotoPickResult.failed('Please choose an image under 2MB.');
    }
    return PhotoPickResult.picked(file);
  } catch (_) {
    return const PhotoPickResult.failed(
      'Could not process that image. Please try again.',
    );
  }
}
