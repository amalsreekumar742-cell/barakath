import 'package:flutter/material.dart';

import '../constants/app_colors.dart';
import '../constants/app_dimens.dart';

/// The colour families a [StatusBadge] can wear (design map §5 "Badge / pill").
enum StatusTone {
  /// Terminal success — Delivered, Confirmed, Approved.
  positive,

  /// Waiting on someone — Pending, Processing, Active.
  pending,

  /// Moving — Shipped, Out for delivery. Blue in the design (node 46:7057), and
  /// distinct from [pending] so "we have it" and "it is on its way" don't wear
  /// the same colour.
  info,

  /// Terminal failure — Rejected, Failed.
  negative,

  /// Spent, lapsed or called off — Used, Expired, Cancelled.
  muted,
}

/// The pill that states where something stands: an order, a replacement, a
/// withdrawal, a coupon.
///
/// WHY one widget across four features: the same word must never be green on
/// the orders screen and grey on the affiliate screen. [StatusBadge.forStatus]
/// owns that mapping so no feature invents its own.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    required this.tone,
    this.dense = false,
  });

  /// Builds a badge from a raw Firestore status string.
  ///
  /// Unknown values fall back to [StatusTone.pending] rather than throwing —
  /// a status added by a newer admin build must still render.
  factory StatusBadge.forStatus(String status, {Key? key, bool dense = false}) {
    return StatusBadge(
      key: key,
      label: status,
      tone: toneFor(status),
      dense: dense,
    );
  }

  final String label;
  final StatusTone tone;

  /// Tighter padding for use inside a list tile rather than a header.
  final bool dense;

  /// CANCELLED IS [StatusTone.muted], NOT negative. The design paints it in the
  /// neutral chip grey (node 46:7087) — a customer cancelling their own order is
  /// a normal outcome, not an error, and red made every cancelled row read like
  /// something had gone wrong. 'Rejected' and 'Failed' stay negative: those are.
  static StatusTone toneFor(String status) =>
      switch (status.trim().toLowerCase()) {
        'delivered' || 'confirmed' || 'approved' || 'paid' || 'published' =>
          StatusTone.positive,
        'shipped' || 'out for delivery' => StatusTone.info,
        'rejected' || 'failed' => StatusTone.negative,
        'cancelled' || 'canceled' || 'used' || 'expired' || 'hidden' =>
          StatusTone.muted,
        _ => StatusTone.pending,
      };

  Color get _fill => switch (tone) {
        StatusTone.positive => AppColors.semanticSuccessSubtle,
        StatusTone.pending => AppColors.goldSubtle,
        StatusTone.info => AppColors.infoSubtle,
        StatusTone.negative => AppColors.statusErrorSubtle,
        StatusTone.muted => AppColors.surfaceSubtle,
      };

  Color get _ink => switch (tone) {
        StatusTone.positive => AppColors.semanticSuccess,
        StatusTone.pending => AppColors.goldBadgeText,
        StatusTone.info => AppColors.info,
        StatusTone.negative => AppColors.statusError,
        StatusTone.muted => AppColors.textSecondary,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: dense ? 9 : 10,
        vertical: dense ? 4 : 5,
      ),
      decoration: BoxDecoration(
        color: _fill,
        borderRadius: BorderRadius.circular(AppDimens.radiusPill),
      ),
      child: Text(
        // Rendered AS STORED, not upper-cased. Every status pill in the design
        // is sentence case ("Out for delivery", not "OUT FOR DELIVERY"), and the
        // Firestore values already arrive capitalised.
        label,
        style: TextStyle(
          color: _ink,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}
