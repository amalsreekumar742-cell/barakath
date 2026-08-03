import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../providers/auth_provider.dart';

/// OtpPage — 6-digit verification (spec §2.3), matching the Figma design: a
/// green mail tile, six code boxes (the focused box outlined green), a resend
/// countdown, and a pinned mustard "Verify & continue" CTA. On success routes
/// new users to profile creation and returning users home.
class OtpPage extends StatefulWidget {
  const OtpPage({
    super.key,
    required this.phone,
    this.countryCode = AppDetails.initialCountryCodeSelection,
  });

  final String phone;

  /// The dial code the OTP was sent with — carried from login so verify/resend
  /// hit the same number MSG91 sent to.
  final String countryCode;

  @override
  State<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends State<OtpPage> {
  final _otpController = TextEditingController();
  final _otpFocus = FocusNode();

  Timer? _timer;
  int _secondsLeft = AppDetails.otpResendSeconds;
  bool _verifying = false;
  bool _resending = false;

  bool get _canResend => _secondsLeft == 0;

  @override
  void initState() {
    super.initState();
    // Set the field directly here (no setState during initState), then tick.
    _secondsLeft = AppDetails.otpResendSeconds;
    _startTicking();
    // Open the keyboard on the code boxes straight away.
    WidgetsBinding.instance.addPostFrameCallback((_) => _otpFocus.requestFocus());
  }

  /// Restart the resend countdown from the top.
  void _startCountdown() {
    setState(() => _secondsLeft = AppDetails.otpResendSeconds);
    _startTicking();
  }

  void _startTicking() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_secondsLeft <= 1) {
        t.cancel();
        setState(() => _secondsLeft = 0);
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  Future<void> _verify([String? code]) async {
    FocusScope.of(context).unfocus();
    final otp = (code ?? _otpController.text).trim();
    if (otp.length != AppDetails.otpLength) {
      AppToast.error(context, 'Enter the 6-digit code');
      return;
    }

    setState(() => _verifying = true);
    final result = await context
        .read<AuthProvider>()
        .verifyOTP(widget.phone, otp, widget.countryCode);
    if (!mounted) return;
    setState(() => _verifying = false);

    if (!result.success) {
      _otpController.clear();
      _otpFocus.requestFocus();
      AppToast.error(context, result.error ?? 'Invalid or expired OTP. Please try again.');
      return;
    }
    context.go(result.isNewUser ? '/create-profile' : '/home');
  }

  Future<void> _resend(String retryType) async {
    if (!_canResend || _resending) return;
    setState(() => _resending = true);
    final error = await context
        .read<AuthProvider>()
        .resendOTP(widget.phone, retryType, widget.countryCode);
    if (!mounted) return;
    setState(() => _resending = false);
    if (error != null) {
      AppToast.error(context, error);
      return;
    }
    _startCountdown();
    AppToast.info(context, retryType == 'voice' ? 'Calling you with your code…' : 'OTP sent again');
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.screenPadding,
            20,
            AppDimens.screenPadding,
            24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Circular back button.
              const CircleBackButton(fallbackRoute: '/login'),
              const SizedBox(height: 28),
              // Green mail tile.
              Container(
                height: 56,
                width: 56,
                decoration: BoxDecoration(
                  color: AppColors.brandGreenSubtle,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.mail_outline_rounded, size: 26, color: AppColors.brandGreen),
              ),
              const SizedBox(height: 20),
              Text(
                'Verify your number',
                style: GoogleFonts.manrope(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.52,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text.rich(
                TextSpan(
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    fontWeight: FontWeight.w400,
                    color: AppColors.textSecondary,
                  ),
                  children: [
                    const TextSpan(text: 'We sent a 6-digit code to '),
                    TextSpan(
                      text: '${widget.countryCode} ${widget.phone}',
                      style: GoogleFonts.manrope(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              _OtpBoxes(
                controller: _otpController,
                focusNode: _otpFocus,
                length: AppDetails.otpLength,
                onCompleted: _verify,
              ),
              const SizedBox(height: 16),
              _ResendSection(
                secondsLeft: _secondsLeft,
                canResend: _canResend,
                resending: _resending,
                onResendText: () => _resend('text'),
                onResendVoice: () => _resend('voice'),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _verifying ? null : () => _verify(),
                  child: _verifying
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.textPrimary,
                          ),
                        )
                      : const Text('Verify & continue'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Six code boxes matching the Figma: white fill, hairline border, and the
/// box awaiting input outlined in brand green.
///
/// WHY hand-built (not pin_code_fields): that package's PinTheme wasn't taking
/// effect and its defaults render empty boxes RED, which fights the design. A
/// single hidden TextField behind painted boxes gives exact control and keeps
/// native paste/keyboard behaviour.
class _OtpBoxes extends StatefulWidget {
  const _OtpBoxes({
    required this.controller,
    required this.focusNode,
    required this.length,
    required this.onCompleted,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final int length;
  final ValueChanged<String> onCompleted;

  @override
  State<_OtpBoxes> createState() => _OtpBoxesState();
}

class _OtpBoxesState extends State<_OtpBoxes> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    widget.focusNode.addListener(_rebuild);
  }

  void _onChanged() {
    setState(() {});
    if (widget.controller.text.length == widget.length) {
      widget.focusNode.unfocus();
      widget.onCompleted(widget.controller.text);
    }
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    widget.focusNode.removeListener(_rebuild);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = widget.controller.text;
    return GestureDetector(
      onTap: () => widget.focusNode.requestFocus(),
      behavior: HitTestBehavior.opaque,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Size the boxes to the available width instead of a fixed 52px — six
          // fixed boxes overran the row on narrower screens and read as
          // oversized. They share the width with even 10px gaps, capped so they
          // don't get comically wide on a tablet.
          const gap = 10.0;
          var boxWidth =
              (constraints.maxWidth - gap * (widget.length - 1)) / widget.length;
          if (boxWidth > 52) boxWidth = 52;
          final boxHeight = boxWidth + 4;
          return Stack(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(widget.length, (i) {
                  final filled = i < text.length;
                  final isNext = i == text.length && widget.focusNode.hasFocus;
                  return Container(
                    height: boxHeight,
                    width: boxWidth,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isNext ? AppColors.brandGreen : AppColors.hairline,
                        width: isNext ? 2 : 1.5,
                      ),
                    ),
                    child: Text(
                      filled ? text[i] : '',
                      style: GoogleFonts.manrope(
                        fontSize: boxWidth * 0.42,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  );
                }),
              ),
              // Invisible input driving the boxes above.
              Positioned.fill(
                child: Opacity(
                  opacity: 0,
                  child: TextField(
                    controller: widget.controller,
                    focusNode: widget.focusNode,
                    keyboardType: TextInputType.number,
                    maxLength: widget.length,
                    showCursor: false,
                    enableInteractiveSelection: false,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: const InputDecoration(
                      counterText: '',
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// A circular white icon button with a hairline border (design back button).
class _ResendSection extends StatelessWidget {
  const _ResendSection({
    required this.secondsLeft,
    required this.canResend,
    required this.resending,
    required this.onResendText,
    required this.onResendVoice,
  });

  final int secondsLeft;
  final bool canResend;
  final bool resending;
  final VoidCallback onResendText;
  final VoidCallback onResendVoice;

  String get _formatted => '00:${secondsLeft.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    if (!canResend) {
      return Text.rich(
        TextSpan(
          style: GoogleFonts.manrope(fontSize: 14, color: AppColors.textSecondary),
          children: [
            const TextSpan(text: 'Resend code in '),
            TextSpan(
              text: _formatted,
              style: GoogleFonts.manrope(fontWeight: FontWeight.w700, color: AppColors.brandGreen),
            ),
          ],
        ),
      );
    }

    return Row(
      children: [
        TextButton.icon(
          onPressed: resending ? null : onResendText,
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: const Text('Resend OTP'),
          style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8)),
        ),
        const SizedBox(width: 4),
        TextButton.icon(
          onPressed: resending ? null : onResendVoice,
          icon: const Icon(Icons.call_outlined, size: 18),
          label: const Text('Resend via Call'),
          style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 8)),
        ),
      ],
    );
  }
}
