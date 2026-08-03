import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/phone_country_code_picker.dart';
import '../providers/auth_provider.dart';

/// LoginPage — phone entry (spec §2.3), matching the Figma design: brand mark,
/// heading, a single phone field with an inline "+91" and a mustard "Send OTP"
/// CTA. Sends an OTP then pushes `/otp`. Country code is fixed to +91.
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _phoneController = TextEditingController();
  final _phoneFocus = FocusNode();
  bool _sending = false;
  String? _error;

  /// Dial code chosen in the picker; sent to MSG91 and carried to the OTP page
  /// so verify/resend use the same code.
  String _countryCode = AppDetails.initialCountryCodeSelection;

  @override
  void initState() {
    super.initState();
    _phoneFocus.addListener(() => setState(() {}));
  }

  String? _validatePhone(String value) {
    if (value.isEmpty) return 'Enter your mobile number';
    // National number length varies by country, so only India keeps the strict
    // 10-digit (starts 6-9) rule; every other dial code is just length-checked.
    if (_countryCode == AppDetails.initialCountryCodeSelection) {
      if (!RegExp(r'^[6-9]\d{9}$').hasMatch(value)) {
        return 'Enter a valid 10-digit number';
      }
      return null;
    }
    if (value.length < 6 || value.length > 15) {
      return 'Enter a valid mobile number';
    }
    return null;
  }

  Future<void> _sendOtp() async {
    FocusScope.of(context).unfocus();
    final phone = _phoneController.text.trim();
    final error = _validatePhone(phone);
    if (error != null) {
      setState(() => _error = error);
      return;
    }
    setState(() {
      _error = null;
      _sending = true;
    });
    final apiError =
        await context.read<AuthProvider>().sendOTP(phone, _countryCode);
    if (!mounted) return;
    setState(() => _sending = false);
    if (apiError != null) {
      AppToast.error(context, apiError);
      return;
    }
    context.push('/otp', extra: {'phone': phone, 'countryCode': _countryCode});
  }

  /// Spec §2.3 — Skip enters guest mode and lands on Home. Guests browse the
  /// catalogue freely; the gated actions (cart, wishlist, wallet, profile,
  /// checkout) each raise the login prompt at the point of use (§2.4).
  void _continueAsGuest() {
    context.read<AuthProvider>().enterGuestMode();
    context.go('/home');
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borderColor = _error != null
        ? AppColors.danger
        : (_phoneFocus.hasFocus ? AppColors.brandGreen : AppColors.hairline);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.screenPadding,
            28,
            AppDimens.screenPadding,
            32,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Flame mark (wordmark cropped out of the logo asset), with Skip
              // opposite it. Skip is NOT in the Figma login frame — it's spec
              // §2.3 ("Skip button on login → Home (guest mode)"), without which
              // guest mode (§2.4) is unreachable. Styled to match onboarding's Skip.
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 40,
                    child: ClipRect(
                      child: Align(
                        alignment: Alignment.topCenter,
                        heightFactor: 0.9,
                        child: Image.asset('assets/images/logo_barakath.png', width: 40),
                      ),
                    ),
                  ),
                  const Spacer(),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _continueAsGuest,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Skip',
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.brandGreen,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 19),
              Text(
                'Enter your mobile number',
                style: GoogleFonts.manrope(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  height: 1.12,
                  letterSpacing: -0.56,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'We\'ll send a 6-digit code to verify it\'s you. No passwords needed.',
                style: GoogleFonts.manrope(
                  fontSize: 15,
                  fontWeight: FontWeight.w400,
                  height: 22.5 / 15,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 24),
              // No "Mobile number" label — the heading above already says it,
              // and the field's own hint carries the instruction.
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: borderColor, width: 2),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
                child: Row(
                  children: [
                    PhoneCountryCodePicker(
                      initialDialCode: _countryCode,
                      onChanged: (code) => setState(() => _countryCode = code),
                      textStyle: GoogleFonts.manrope(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Container(width: 1, height: 22, color: AppColors.hairline),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _phoneController,
                        focusNode: _phoneFocus,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _sendOtp(),
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                        maxLength: _countryCode == AppDetails.initialCountryCodeSelection
                            ? 10
                            : 15,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        style: GoogleFonts.manrope(
                          fontSize: 15,
                          fontWeight: FontWeight.w400,
                          color: AppColors.textPrimary,
                        ),
                        decoration: InputDecoration(
                          counterText: '',
                          isCollapsed: true,
                          // The wrapping Container draws the only box. `border`
                          // alone is NOT enough: the theme's enabledBorder /
                          // focusedBorder take precedence over it, which is what
                          // was painting a second outline around the hint. Every
                          // state has to be cleared, and `filled` turned off.
                          filled: false,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          errorBorder: InputBorder.none,
                          focusedErrorBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                          hintText: 'Enter number',
                          hintStyle: GoogleFonts.manrope(
                            fontSize: 15,
                            color: AppColors.textFaint,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 6),
                Text(
                  _error!,
                  style: GoogleFonts.manrope(fontSize: 12, color: AppColors.danger),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _sending ? null : _sendOtp,
                  child: _sending
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.textPrimary,
                          ),
                        )
                      : const Text('Send OTP'),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text(
                  'By continuing you agree to our Terms & Privacy Policy',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textFaint,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
