import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/constants.dart';

/// One onboarding slide's copy (spec §2.2 — exact Figma text).
class _Slide {
  const _Slide({required this.title, required this.body});
  final String title;
  final String body;
}

/// OnboardingPage — 3 swipeable intro slides matching the Figma design: a
/// full-bleed hero image, "Skip" (top-right), pill page-dots, and a mustard
/// primary CTA ("Next" / "Get started"). "Skip" and finishing the last slide
/// both mark onboarding complete and route to `/login`.
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final PageController _controller = PageController();
  int _index = 0;

  static const List<_Slide> _slides = [
    _Slide(
      title: 'Four worlds, one store',
      body:
          'Perfumes, books, clothing and Islamic essentials — handpicked and delivered with care.',
    ),
    _Slide(
      title: 'Spin, earn, save',
      body:
          'Win rewards on Spin & Win, stack coupons and pay with your wallet. The more you shop, the more you save.',
    ),
    _Slide(
      title: 'Checkout in seconds',
      body:
          'Saved addresses, one-tap payment and free delivery over ₹40. Nice — that\'s on its way!',
    ),
  ];

  bool get _isLast => _index == _slides.length - 1;

  Future<void> _finish() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(PrefKeys.onboardingComplete, true);
    if (!mounted) return;
    context.go('/login');
  }

  void _next() {
    if (_isLast) {
      _finish();
    } else {
      _controller.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Skip — top-right, brand green, on every slide.
            Align(
              alignment: Alignment.centerRight,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 4, 26, 6),
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _finish,
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
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (context, i) =>
                    _OnboardSlide(slide: _slides[i], activeIndex: i, count: _slides.length),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(28, 24, 28, 28),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _next,
                  child: Text(_isLast ? 'Get started' : 'Next'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardSlide extends StatelessWidget {
  const _OnboardSlide({
    required this.slide,
    required this.activeIndex,
    required this.count,
  });

  final _Slide slide;
  final int activeIndex;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Full-bleed hero photograph (same image across slides, per design).
        Expanded(
          child: SizedBox(
            width: double.infinity,
            child: Image.asset(
              'assets/images/onboarding_hero.png',
              fit: BoxFit.cover,
              alignment: Alignment.center,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(28, 28, 28, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Dots(active: activeIndex, count: count),
              const SizedBox(height: 30),
              Text(
                slide.title,
                style: GoogleFonts.manrope(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  height: 32.2 / 28,
                  letterSpacing: -0.56,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                slide.body,
                style: GoogleFonts.manrope(
                  fontSize: 15,
                  fontWeight: FontWeight.w400,
                  height: 23.25 / 15,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Pill page indicator: active dot is a 22×6 green pill, others 6×6 grey.
class _Dots extends StatelessWidget {
  const _Dots({required this.active, required this.count});
  final int active;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(count, (i) {
        final isActive = i == active;
        return Container(
          margin: EdgeInsets.only(right: i == count - 1 ? 0 : 8),
          height: 6,
          width: isActive ? 22 : 6,
          decoration: BoxDecoration(
            color: isActive ? AppColors.brandGreen : AppColors.hairline,
            borderRadius: BorderRadius.circular(9999),
          ),
        );
      }),
    );
  }
}
