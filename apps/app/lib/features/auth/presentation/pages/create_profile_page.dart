import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../providers/auth_provider.dart';

/// CreateProfilePage — optional, skippable profile step for new users
/// (spec §2.3), matching the Figma design: a green initial-avatar with a gold
/// edit badge and four labelled fields. Photo → cropped to a circle → compressed
/// → uploaded (via provider → datasource). Every field is optional; "Enter
/// Barakath" saves whatever was filled and "Skip" jumps straight to home.
class CreateProfilePage extends StatefulWidget {
  const CreateProfilePage({super.key});

  @override
  State<CreateProfilePage> createState() => _CreateProfilePageState();
}

/// Longest edge of the stored avatar, in pixels.
///
/// The Storage rule on `users/{uid}/**` rejects anything >= 2MB, so the upload
/// MUST be downscaled rather than sent at camera resolution. 1024 is well inside
/// that budget at JPEG quality 70 and still far above the 100px the avatar is
/// drawn at.
const int _maxAvatarPx = 1024;

/// Hard ceiling enforced by `firebase/storage.rules` (`validImage`). Checked
/// client-side too so an oversized photo is refused with copy the customer can
/// act on, instead of a `storage/unauthorized` from the rule.
const int _maxAvatarBytes = 2 * 1024 * 1024;

class _CreateProfilePageState extends State<CreateProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _whatsappController = TextEditingController();
  final _friendCodeController = TextEditingController();
  final _emailController = TextEditingController();

  final _picker = ImagePicker();

  Uint8List? _photoPreview;
  String? _photoUrl;
  bool _uploadingPhoto = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    // The avatar shows the display-name initial — rebuild as it's typed.
    _nameController.addListener(() => setState(() {}));
  }

  // --- Photo pipeline -------------------------------------------------------

  Future<void> _pickPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
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
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (source == null) return;

    try {
      final picked = await _picker.pickImage(source: source, imageQuality: 90);
      if (picked == null) return;

      final cropped = await ImageCropper().cropImage(
        sourcePath: picked.path,
        aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
        // The cropper emits a compressed JPEG directly, so no separate compression
        // step is needed. Quality 70 keeps avatar uploads small.
        compressQuality: 70,
        compressFormat: ImageCompressFormat.jpg,
        // Downscale to at most 1024x1024 BEFORE upload. This is not a nicety: the
        // Storage rule guarding `users/{uid}/**` rejects anything >= 2MB
        // (firebase/storage.rules `validImage`), and a square crop of a modern
        // phone photo at quality 70 clears that comfortably. Verified live: a
        // 2.5MB upload to this exact path fails with `storage/unauthorized`,
        // which reached the customer as a bare "Photo upload failed".
        // The avatar renders at 100px, so 1024 is already generous.
        maxWidth: _maxAvatarPx,
        maxHeight: _maxAvatarPx,
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
      if (cropped == null) return;

      final bytes = await cropped.readAsBytes();

      // Backstop for the Storage rule. The downscale above should keep every
      // photo well under this, so reaching here means something unusual (a huge
      // PNG-sourced crop, say) — say so plainly rather than letting the rule
      // reject it as an unexplained "unauthorized".
      if (bytes.lengthInBytes >= _maxAvatarBytes) {
        if (!mounted) return;
        AppToast.error(context, 'That photo is too large. Please pick a smaller one.');
        return;
      }

      if (!mounted) return;
      setState(() {
        _photoPreview = bytes;
        _uploadingPhoto = true;
      });

      await _uploadPhoto(bytes);
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadingPhoto = false);
      // `e` is deliberately included. This catch covers the picker AND the
      // cropper, and the previous fixed string meant a plugin failure (a missing
      // uCrop activity, a revoked permission, an unreadable file) was
      // indistinguishable from any other — on a customer's device, with no logs
      // to consult. `AppToast.error` truncates, and the prefix keeps the message
      // recognisable.
      AppToast.error(context, 'Could not process the image: ${_readable(e)}');
    }
  }

  Future<void> _uploadPhoto(Uint8List bytes) async {
    final error = await context.read<AuthProvider>().uploadProfilePhoto(bytes);
    if (!mounted) return;
    if (error.url == null) {
      setState(() => _uploadingPhoto = false);
      // The provider now carries the datasource's message up (it used to discard
      // the Failure and return a bare null), so a rules rejection or a dropped
      // connection each read as themselves instead of one catch-all string.
      AppToast.error(context, error.message ?? 'Photo upload failed. You can add it later.');
      return;
    }
    setState(() {
      _photoUrl = error.url;
      _uploadingPhoto = false;
    });
  }

  /// The useful part of a platform error, without the SDK framing a customer
  /// cannot act on.
  String _readable(Object e) {
    if (e is PlatformException) {
      final message = e.message?.trim();
      return (message == null || message.isEmpty) ? e.code : message;
    }
    return e.toString();
  }

  // --- Validators -----------------------------------------------------------

  String? _validateName(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return null; // Optional.
    if (v.length < 2) return 'Name must be at least 2 characters';
    return null;
  }

  String? _validateEmail(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return null; // Optional.
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
      return 'Enter a valid email address';
    }
    return null;
  }

  // --- Save -----------------------------------------------------------------

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    final error = await context.read<AuthProvider>().createProfile(
          fullName: _nameController.text.trim(),
          email: _emailController.text.trim(),
          whatsapp: _whatsappController.text.trim(),
          friendCode: _friendCodeController.text.trim(),
          photoUrl: _photoUrl,
        );
    if (!mounted) return;
    setState(() => _saving = false);
    if (error != null) {
      AppToast.error(context, error);
      return;
    }
    context.go('/home');
  }

  void _skip() {
    // Tell the guard to stand down, or it redirects straight back here.
    context.read<AuthProvider>().skipProfileSetup();
    context.go('/home');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _whatsappController.dispose();
    _friendCodeController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final initial = _nameController.text.trim().isEmpty
        ? ''
        : _nameController.text.trim()[0].toUpperCase();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.screenPadding,
            16,
            AppDimens.screenPadding,
            28,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top row: circular back + green Skip.
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const CircleBackButton(),
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _skip,
                      child: Text(
                        'Skip',
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.brandGreen,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Create your profile',
                  style: GoogleFonts.manrope(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.52,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Tell us a little about you — you can skip and do this later.',
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    fontWeight: FontWeight.w400,
                    height: 22.5 / 15,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: _AvatarPicker(
                    preview: _photoPreview,
                    initial: initial,
                    uploading: _uploadingPhoto,
                    onTap: _uploadingPhoto ? null : _pickPhoto,
                  ),
                ),
                const SizedBox(height: 28),
                _Field(
                  label: _label('Display name'),
                  controller: _nameController,
                  hint: 'Your name',
                  validator: _validateName,
                  keyboardType: TextInputType.name,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                _Field(
                  label: _label('WhatsApp number', optional: true),
                  controller: _whatsappController,
                  hint: '10-digit number',
                  keyboardType: TextInputType.phone,
                  maxLength: 10,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                _Field(
                  label: _label('Friend\'s code', optional: true),
                  controller: _friendCodeController,
                  hint: 'Referral code',
                  prefixIcon: Icons.card_giftcard_rounded,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 16),
                _Field(
                  label: _label('Email address', optional: true),
                  controller: _emailController,
                  hint: 'you@email.com',
                  prefixIcon: Icons.mail_outline_rounded,
                  validator: _validateEmail,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: (_saving || _uploadingPhoto) ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.textPrimary,
                            ),
                          )
                        : const Text('Enter Barakath'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// A field label: bold name, with a faint "(optional)" suffix when applicable.
  Widget _label(String name, {bool optional = false}) {
    return Text.rich(
      TextSpan(
        style: GoogleFonts.manrope(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.textSecondary,
        ),
        children: [
          TextSpan(text: name),
          if (optional)
            TextSpan(
              text: ' (optional)',
              style: GoogleFonts.manrope(
                fontSize: 13,
                fontWeight: FontWeight.w400,
                color: AppColors.textFaint,
              ),
            ),
        ],
      ),
    );
  }
}

/// A labelled input row: the label widget above a themed text field.
class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.hint,
    this.prefixIcon,
    this.validator,
    this.keyboardType,
    this.maxLength,
    this.inputFormatters,
    this.textInputAction,
  });

  final Widget label;
  final TextEditingController controller;
  final String hint;
  final IconData? prefixIcon;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        label,
        const SizedBox(height: 7),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          maxLength: maxLength,
          inputFormatters: inputFormatters,
          textInputAction: textInputAction,
          style: GoogleFonts.manrope(fontSize: 15, color: AppColors.textPrimary),
          decoration: InputDecoration(
            counterText: '',
            hintText: hint,
            prefixIcon: prefixIcon == null
                ? null
                : Icon(prefixIcon, size: 20, color: AppColors.textFaint),
          ),
        ),
      ],
    );
  }
}

/// Circular white icon button with a hairline border.
/// Green circular avatar showing the name initial (or the picked photo), with a
/// gold edit badge — matching the Figma profile design.
class _AvatarPicker extends StatelessWidget {
  const _AvatarPicker({
    required this.preview,
    required this.initial,
    required this.uploading,
    required this.onTap,
  });

  final Uint8List? preview;
  final String initial;
  final bool uploading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            height: 100,
            width: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.brandGreenDark,
              image: preview != null
                  ? DecorationImage(image: MemoryImage(preview!), fit: BoxFit.cover)
                  : null,
            ),
            alignment: Alignment.center,
            child: preview != null
                ? null
                : (initial.isNotEmpty
                    ? Text(
                        initial,
                        style: GoogleFonts.manrope(
                          fontSize: 40,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.person_outline_rounded, size: 44, color: Colors.white)),
          ),
          if (uploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.black.withValues(alpha: 0.35),
                ),
                alignment: Alignment.center,
                child: const SizedBox(
                  height: 22,
                  width: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
              ),
            ),
          Positioned(
            bottom: 2,
            right: 2,
            child: Container(
              height: 30,
              width: 30,
              decoration: BoxDecoration(
                color: AppColors.cta,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.background, width: 3),
              ),
              child: const Icon(Icons.edit, size: 14, color: AppColors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}
