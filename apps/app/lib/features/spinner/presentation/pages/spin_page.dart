import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/custom_button.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../domain/entities/spin_result.dart';
import '../../domain/entities/spinner_campaign.dart';
import '../providers/spinner_provider.dart';
import '../widgets/spin_result_sheet.dart';
import '../widgets/spin_wheel_view.dart';

/// Spin & Win (spec §2.23).
///
/// THE SEQUENCE IS THE FEATURE:
///   tap → button disabled, spinning state → `spinWheel` callable → take the
///   RETURNED slot, find its wedge, animate onto it → sheet → re-read spins
///   remaining from the server.
/// The client never picks the winner, and it never animates on a failed call —
/// a rejection (no spins left, campaign ended, cooldown) is a toast plus a state
/// refresh, because a wheel that spins and then says "no" is a lie about what
/// happened.
class SpinPage extends StatefulWidget {
  const SpinPage({super.key});

  @override
  State<SpinPage> createState() => _SpinPageState();
}

class _SpinPageState extends State<SpinPage> with SingleTickerProviderStateMixin {
  static const Duration _spinDuration = Duration(milliseconds: 4000);

  /// Full turns before the wheel settles — long enough to read as a spin.
  static const int _fullTurns = 5;

  late final AnimationController _controller;
  Animation<double> _rotation = const AlwaysStoppedAnimation<double>(0);

  /// Where the wheel currently rests, in radians. Kept so consecutive spins
  /// continue from the last wedge instead of snapping back to 12 o'clock.
  double _angle = 0;

  /// Covers the whole tap→callable→animation→sheet sequence, which is longer
  /// than the provider's `isSpinning` (that ends when the call returns).
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _spinDuration);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SpinnerProvider>().loadSpin();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // --- Spin sequence ---------------------------------------------------------

  Future<void> _onSpin() async {
    if (_busy) return;
    final provider = context.read<SpinnerProvider>();

    setState(() => _busy = true);
    final result = await provider.spin();
    if (!mounted) return;

    if (result == null) {
      // Rejected server-side. No animation — just say why and re-sync.
      final message = provider.error ?? 'Could not spin right now.';
      setState(() => _busy = false);
      AppToast.error(context, message);
      provider.clearError();
      await provider.refreshAvailability();
      return;
    }

    await _animateToWinner(result, provider.slots);
    if (!mounted) return;

    // Spins remaining comes from the server, not a local decrement, so the
    // sheet's "Spin again (X left)" can't disagree with the callable.
    await provider.refreshAvailability();
    if (!mounted) return;

    setState(() => _busy = false);

    await SpinResultSheet.show(
      context,
      result: result,
      spinsRemaining: provider.spinsRemaining,
      onSaveToCoupons: () {
        Navigator.of(context).pop();
        context.push('/my-coupons');
      },
      onSpinAgain: () {
        Navigator.of(context).pop();
        _onSpin();
      },
    );
  }

  /// Turns [_fullTurns] times, then lands the pointer on the wedge the server
  /// returned.
  ///
  /// Geometry: wedge 0 starts at 12 o'clock and they run clockwise, so wedge
  /// `i`'s centre sits at `(i + 0.5) * sweep`. Rotating the wheel by
  /// `2π − (i + 0.5) * sweep` brings that centre back under the fixed pointer.
  Future<void> _animateToWinner(SpinResult result, List<SpinnerSlot> slots) async {
    if (slots.isEmpty) return;

    final index = _indexOfWinner(result, slots);
    final sweep = 2 * math.pi / slots.length;
    final target = (2 * math.pi) - ((index + 0.5) * sweep);

    final current = _angle % (2 * math.pi);
    var delta = target - current;
    while (delta < 0) {
      delta += 2 * math.pi;
    }
    final end = _angle + (2 * math.pi * _fullTurns) + delta;

    setState(() {
      _rotation = Tween<double>(begin: _angle, end: end).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
      );
    });

    try {
      // `.orCancel` so leaving the screen mid-spin ends the wait instead of
      // throwing TickerCanceled out of the sequence.
      await _controller.forward(from: 0).orCancel;
    } catch (_) {
      return;
    }
    _angle = end;
  }

  /// The wedge the server landed on. Matched on label + type first so two
  /// wedges sharing a label (a wheel with two "Better luck" slots) still
  /// resolve; falls back to the first label match, then to wedge 0 rather than
  /// throwing — a wheel that stops somewhere beats a crash.
  int _indexOfWinner(SpinResult result, List<SpinnerSlot> slots) {
    final label = result.slotLabel.trim();
    final exact = slots.indexWhere(
      (s) => s.label.trim() == label && s.type == result.resultType,
    );
    if (exact >= 0) return exact;
    final byLabel = slots.indexWhere((s) => s.label.trim() == label);
    if (byLabel >= 0) return byLabel;
    return 0;
  }


  // --- Build -----------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SpinnerProvider>();

    return Scaffold(
      body: Container(
        // The one dark stage in the app: the design puts the wheel on a warm
        // ink gradient so the gold wedges and confetti carry. Both stops are
        // existing tokens (ink → inkSoft), not new colours.
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.ink, AppColors.inkSoft],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _Header(onBack: () => _onBack(context)),
              Expanded(child: _buildBody(provider)),
            ],
          ),
        ),
      ),
    );
  }

  void _onBack(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  Widget _buildBody(SpinnerProvider provider) {
    switch (provider.state) {
      case SpinViewState.idle:
      case SpinViewState.loading:
        return const _SpinSkeleton();

      case SpinViewState.error:
        return _Message(
          icon: Icons.wifi_off_rounded,
          title: 'Could not load the wheel',
          body: provider.error ?? 'Please try again.',
          onRetry: () => provider.loadSpin(),
        );

      case SpinViewState.noCampaign:
        // Message only, spin button hidden (spec §2.25 — empty states carry no
        // action button).
        return const _Message(
          icon: Icons.casino_outlined,
          title: 'No spin running right now',
          body: 'Check back soon — new spin campaigns are announced in the app.',
        );

      case SpinViewState.ready:
        if (!provider.isEligible) {
          return _Message(
            icon: Icons.lock_outline_rounded,
            title: 'Not available for you',
            body: provider.ineligibleMessage ??
                'This campaign is for a different set of customers.',
          );
        }
        return _buildWheel(provider);
    }
  }

  Widget _buildWheel(SpinnerProvider provider) {
    final campaign = provider.campaign!;
    final availability = provider.availability;
    final outOfSpins = availability.spinsRemaining <= 0;
    final coolingDown = availability.cooldownHoursRemaining > 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      child: Column(
        children: [
          const Text(
            'Feeling lucky?',
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: AppDimens.space8),
          _SpinsChip(
            label: outOfSpins
                ? 'No spins left'
                : availability.spinsLeftLabel,
          ),
          const SizedBox(height: AppDimens.space24),

          AnimatedBuilder(
            animation: _controller,
            builder: (_, __) => SpinWheelView(
              slots: provider.slots,
              rotation: _rotation.value,
            ),
          ),

          const SizedBox(height: AppDimens.space24),

          if (coolingDown)
            _Note(
              'Come back in ${availability.cooldownHoursRemaining} '
              '${availability.cooldownHoursRemaining == 1 ? 'hour' : 'hours'} '
              'for your next spin.',
            )
          else if (outOfSpins)
            const _Note('You have used all your spins for this campaign.')
          else
            CustomButton(
              label: 'Spin now',
              isLoading: _busy,
              onPressed: provider.canSpin && !_busy ? _onSpin : null,
            ),

          const SizedBox(height: AppDimens.space12),
          _Note(
            'Rewards become coupons · valid ${campaign.validityLabel} · one per order',
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space8,
        AppDimens.screenPadding,
        AppDimens.space12,
      ),
      child: Row(
        children: [
          CircleBackButton(onTap: onBack, style: CircleBackStyle.onDark),
          const SizedBox(width: AppDimens.space14),
          const Text(
            'Spin & Win',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// "3 spins left" — the pill under the title.
class _SpinsChip extends StatelessWidget {
  const _SpinsChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimens.space12,
        vertical: AppDimens.space6,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 12,
        color: Colors.white.withValues(alpha: 0.6),
      ),
    );
  }
}

/// Empty / ineligible / error, styled for the dark stage. Message only unless a
/// retry is explicitly passed (an error is not an empty state).
class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    required this.body,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String body;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                icon,
                size: 40,
                color: Colors.white.withValues(alpha: 0.6),
              ),
            ),
            const SizedBox(height: AppDimens.space20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: AppDimens.space8),
            Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                color: Colors.white.withValues(alpha: 0.7),
              ),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: AppDimens.space24),
              TextButton(
                onPressed: onRetry,
                style: TextButton.styleFrom(foregroundColor: AppColors.cta),
                child: const Text('Try again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Shimmer shaped like the loaded screen: title, chip, wheel, button.
class _SpinSkeleton extends StatelessWidget {
  const _SpinSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppDimens.screenPadding,
        vertical: AppDimens.space12,
      ),
      child: ShimmerLoading(
        child: Column(
          children: [
            ShimmerBox(width: 180, height: 26, borderRadius: 8),
            SizedBox(height: AppDimens.space12),
            ShimmerBox(width: 110, height: 26, borderRadius: AppDimens.radiusPill),
            SizedBox(height: AppDimens.space24),
            ShimmerBox(width: 260, height: 260, borderRadius: 130),
            SizedBox(height: AppDimens.space24),
            ShimmerBox(
              width: double.infinity,
              height: AppDimens.buttonHeight,
              borderRadius: AppDimens.radiusMd,
            ),
          ],
        ),
      ),
    );
  }
}
