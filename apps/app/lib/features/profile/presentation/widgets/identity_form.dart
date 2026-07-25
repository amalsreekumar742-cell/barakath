import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../auth/domain/entities/user.dart';
import '../providers/profile_provider.dart';
import 'confirm_dialog.dart';
import 'profile_avatar.dart';
import 'profile_photo_picker.dart';

/// The customer's editable identity block — the ONE save path shared by Edit
/// profile and Settings.
///
/// WHY one widget for two screens: they write the same four fields to the same
/// document. Two copies would be two validators, two keyword rebuilds and two
/// chances for one screen to forget the confirmation dialog.
///
/// The login phone is displayed but NOT editable: it is the account identity,
/// established by the OTP flow. There is deliberately no "Friend's code" field
/// either — `friendCode` is captured at signup and consumed once for referral
/// attribution (design map §4 row 10).
class IdentityForm extends StatefulWidget {
  const IdentityForm({
    super.key,
    required this.user,
    this.showPhoto = false,
    this.nameLabel = 'Display name',
    this.whatsappLabel = 'WhatsApp number',
    this.emailLabel = 'Email address',
    this.saveLabel = 'Save changes',
    this.popOnSave = false,
  });

  final User user;

  /// Edit profile shows the avatar + "Change photo"; Settings does not.
  final bool showPhoto;

  final String nameLabel;
  final String whatsappLabel;
  final String emailLabel;
  final String saveLabel;

  /// Edit profile returns to the profile screen after a successful save;
  /// Settings stays put.
  final bool popOnSave;

  @override
  State<IdentityForm> createState() => _IdentityFormState();
}

class _IdentityFormState extends State<IdentityForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _whatsappController = TextEditingController();
  final _emailController = TextEditingController();

  File? _photo;

  /// The document arrives asynchronously and then keeps streaming. Seeding the
  /// controllers only on the FIRST non-empty snapshot stops a later snapshot
  /// from overwriting what the customer is currently typing.
  bool _seeded = false;

  @override
  void initState() {
    super.initState();
    _seed();
    _nameController.addListener(() => setState(() {})); // avatar initial
  }

  @override
  void didUpdateWidget(covariant IdentityForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    _seed();
  }

  void _seed() {
    if (_seeded) return;
    final user = widget.user;
    if (user.id.isEmpty) return;
    _nameController.text = user.fullName;
    _whatsappController.text = user.whatsapp;
    _emailController.text = user.email;
    _seeded = true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _whatsappController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  // --- Validation -----------------------------------------------------------

  String? _validateName(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return null; // optional, as it is at signup
    if (v.length < 2) return 'Name must be at least 2 characters';
    return null;
  }

  String? _validateWhatsapp(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return null;
    if (v.length != 10) return 'Enter a 10-digit number';
    return null;
  }

  String? _validateEmail(String? value) {
    final v = (value ?? '').trim();
    if (v.isEmpty) return null;
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
      return 'Enter a valid email address';
    }
    return null;
  }

  // --- Actions --------------------------------------------------------------

  Future<void> _pickPhoto() async {
    final result = await pickProfilePhoto(context);
    if (!mounted) return;
    if (result.error != null) {
      AppToast.error(context, result.error!);
      return;
    }
    if (result.file != null) setState(() => _photo = result.file);
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final confirmed = await showConfirmDialog(
      context,
      title: 'Save changes?',
      message: 'Your profile details will be updated.',
      confirmLabel: 'Save',
    );
    if (!confirmed || !mounted) return;

    final error = await context.read<ProfileProvider>().updateProfile(
          fullName: _nameController.text.trim(),
          whatsapp: _whatsappController.text.trim(),
          email: _emailController.text.trim(),
          photo: _photo,
        );
    if (!mounted) return;

    if (error != null) {
      AppToast.error(context, error);
      return;
    }

    setState(() => _photo = null);
    AppToast.success(context, 'Profile updated');
    if (widget.popOnSave && context.canPop()) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final isSaving = context.select<ProfileProvider, bool>((p) => p.isSaving);

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.showPhoto) ...[
            Center(
              child: Column(
                children: [
                  GestureDetector(
                    onTap: isSaving ? null : _pickPhoto,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        ProfileAvatar(
                          imageUrl: widget.user.profileImage,
                          fullName: _nameController.text,
                          localFile: _photo,
                          size: 96,
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            height: 30,
                            width: 30,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppColors.cta,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.background,
                                width: 3,
                              ),
                            ),
                            child: const Icon(
                              Icons.edit,
                              size: 14,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppDimens.space10),
                  GestureDetector(
                    onTap: isSaving ? null : _pickPhoto,
                    behavior: HitTestBehavior.opaque,
                    child: const Text(
                      'Change photo',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.brandGreen,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppDimens.space24),
          ],
          _LabelledField(
            label: widget.nameLabel,
            controller: _nameController,
            hint: 'Your name',
            validator: _validateName,
            keyboardType: TextInputType.name,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppDimens.gapCards),
          // Read-only: the login phone identifies the account (spec §2.3).
          _ReadOnlyField(label: 'Mobile', value: _displayPhone),
          const SizedBox(height: AppDimens.gapCards),
          _LabelledField(
            label: widget.whatsappLabel,
            controller: _whatsappController,
            hint: '10-digit number',
            optional: true,
            validator: _validateWhatsapp,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: AppDimens.gapCards),
          _LabelledField(
            label: widget.emailLabel,
            controller: _emailController,
            hint: 'you@email.com',
            optional: true,
            validator: _validateEmail,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: AppDimens.space20),
          CustomButton(
            label: widget.saveLabel,
            isLoading: isSaving,
            onPressed: isSaving ? null : _save,
          ),
        ],
      ),
    );
  }

  /// The stored phone already carries its country code in most documents; show
  /// it verbatim rather than re-formatting a value we did not write.
  String get _displayPhone =>
      widget.user.phone.trim().isEmpty ? '—' : widget.user.phone.trim();
}

/// Label above a themed input, with the design's faint "(optional)" suffix.
class _LabelledField extends StatelessWidget {
  const _LabelledField({
    required this.label,
    required this.controller,
    required this.hint,
    this.optional = false,
    this.validator,
    this.keyboardType,
    this.maxLength,
    this.inputFormatters,
    this.textInputAction,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final bool optional;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text.rich(
          TextSpan(
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
            children: [
              TextSpan(text: label),
              if (optional)
                const TextSpan(
                  text: ' (optional)',
                  style: TextStyle(
                    fontWeight: FontWeight.w400,
                    color: AppColors.textFaint,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppDimens.space6),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          maxLength: maxLength,
          inputFormatters: inputFormatters,
          textInputAction: textInputAction,
          style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(hintText: hint, counterText: ''),
        ),
      ],
    );
  }
}

/// A field-shaped, non-editable value (the design's "Mobile" row).
class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: AppDimens.space6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimens.space16,
            vertical: 13,
          ),
          decoration: BoxDecoration(
            color: AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(AppDimens.radiusMd),
            border: Border.all(color: AppColors.borderStrong),
          ),
          child: Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ],
    );
  }
}
