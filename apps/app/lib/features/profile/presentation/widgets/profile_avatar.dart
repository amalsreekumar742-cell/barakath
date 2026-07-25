import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/cached_image.dart';

/// The circular customer avatar: the uploaded `profileImage`, a locally picked
/// file while an edit is in flight, or the name's initial on the design's green
/// gradient. A nameless account falls back to a person glyph rather than an
/// empty green disc.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.imageUrl,
    required this.fullName,
    this.localFile,
    this.size = 64,
  });

  final String imageUrl;
  final String fullName;

  /// A just-picked photo, shown before it has been uploaded.
  final File? localFile;

  final double size;

  String get _initial {
    final name = fullName.trim();
    return name.isEmpty ? '' : name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final Widget content;
    if (localFile != null) {
      content = Image.file(localFile!, fit: BoxFit.cover, width: size, height: size);
    } else if (imageUrl.trim().isNotEmpty) {
      content = CachedImage(
        url: imageUrl,
        width: size,
        height: size,
        borderRadius: size / 2,
      );
    } else if (_initial.isNotEmpty) {
      content = Text(
        _initial,
        style: TextStyle(
          fontSize: size * 0.375,
          fontWeight: FontWeight.w800,
          color: Colors.white,
        ),
      );
    } else {
      content = Icon(
        Icons.person_outline_rounded,
        size: size * 0.44,
        color: Colors.white,
      );
    }

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.brandGreen, AppColors.brandGreenDark],
        ),
      ),
      child: ClipOval(child: content),
    );
  }
}
