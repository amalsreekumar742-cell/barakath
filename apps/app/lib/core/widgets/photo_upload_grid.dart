import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';
import 'app_toast.dart';

/// Picks, crops and validates the photos attached to a replacement request or a
/// review (spec §2.18, §2.24, §2.25).
///
/// Validation is spec §2.25: **max 2MB, JPG/PNG/WebP only**. Rejections are
/// surfaced as a toast naming the reason — a silently dropped photo reads as a
/// broken button.
///
/// Returns `List<File>`; the caller uploads via StorageService AFTER the parent
/// document exists, so the storage path can contain the document id.
class PhotoUploadGrid extends StatefulWidget {
  const PhotoUploadGrid({
    super.key,
    required this.maxPhotos,
    required this.onChanged,
    this.initial = const [],
    this.tileSize = 84,
  });

  final int maxPhotos;
  final ValueChanged<List<File>> onChanged;
  final List<File> initial;
  final double tileSize;

  @override
  State<PhotoUploadGrid> createState() => _PhotoUploadGridState();
}

class _PhotoUploadGridState extends State<PhotoUploadGrid> {
  static const int _maxBytes = 2 * 1024 * 1024;
  static const Set<String> _allowed = {'jpg', 'jpeg', 'png', 'webp'};

  late List<File> _photos = [...widget.initial];
  final _picker = ImagePicker();
  bool _busy = false;

  Future<void> _add(ImageSource source) async {
    if (_photos.length >= widget.maxPhotos) {
      if (mounted) AppToast.error(context, 'You can add up to ${widget.maxPhotos} photos');
      return;
    }

    setState(() => _busy = true);
    try {
      final picked = await _picker.pickImage(source: source, imageQuality: 90);
      if (picked == null) return;

      // Type is checked BEFORE cropping: the cropper re-encodes, which would
      // mask an unsupported original.
      final ext = picked.path.split('.').last.toLowerCase();
      if (!_allowed.contains(ext)) {
        if (mounted) AppToast.error(context, 'Only JPG, PNG or WebP images are allowed');
        return;
      }

      final cropped = await ImageCropper().cropImage(
        sourcePath: picked.path,
        compressFormat: ImageCompressFormat.jpg,
        compressQuality: 90,
        // Evidence photos need detail (a damaged product, a review shot), so this
        // cap is far looser than the avatar's — but it must exist. Without it a
        // modern phone photo routinely lands over the 2MB Storage limit and the
        // grid refuses the customer's picture outright. 1920 on the long edge is
        // full-HD: plenty to show damage, comfortably inside the cap.
        maxWidth: 1920,
        maxHeight: 1920,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop photo',
            toolbarColor: AppColors.surface,
            toolbarWidgetColor: AppColors.textPrimary,
            activeControlsWidgetColor: AppColors.brandGreen,
            lockAspectRatio: false,
          ),
          IOSUiSettings(title: 'Crop photo'),
        ],
      );
      if (cropped == null) return;

      final file = File(cropped.path);
      // Size is checked AFTER cropping, because cropping is what determines the
      // bytes actually uploaded.
      if (await file.length() > _maxBytes) {
        if (mounted) AppToast.error(context, 'That photo is over 2MB — try a smaller one');
        return;
      }

      setState(() => _photos = [..._photos, file]);
      widget.onChanged(_photos);
    } catch (_) {
      if (mounted) AppToast.error(context, 'Could not add that photo');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _remove(int index) {
    setState(() => _photos = [..._photos]..removeAt(index));
    widget.onChanged(_photos);
  }

  Future<void> _pickSource() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppDimens.space8),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
            ),
            const SizedBox(height: AppDimens.space8),
          ],
        ),
      ),
    );
    if (source != null) await _add(source);
  }

  @override
  Widget build(BuildContext context) {
    final canAdd = _photos.length < widget.maxPhotos;

    return Wrap(
      spacing: AppDimens.space10,
      runSpacing: AppDimens.space10,
      children: [
        for (var i = 0; i < _photos.length; i++)
          SizedBox(
            width: widget.tileSize,
            height: widget.tileSize,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                  child: Image.file(
                    _photos[i],
                    width: widget.tileSize,
                    height: widget.tileSize,
                    fit: BoxFit.cover,
                  ),
                ),
                Positioned(
                  top: -6,
                  right: -6,
                  child: GestureDetector(
                    onTap: () => _remove(i),
                    child: Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.ink,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded,
                          size: 14, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
          ),
        if (canAdd)
          GestureDetector(
            onTap: _busy ? null : _pickSource,
            child: Container(
              width: widget.tileSize,
              height: widget.tileSize,
              decoration: BoxDecoration(
                color: AppColors.surfaceSubtle,
                borderRadius: BorderRadius.circular(AppDimens.radiusMd),
                border: Border.all(color: AppColors.hairline),
              ),
              child: _busy
                  ? const Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_rounded,
                            size: 22, color: AppColors.textSecondary),
                        SizedBox(height: 2),
                        Text(
                          'Add',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
      ],
    );
  }
}
