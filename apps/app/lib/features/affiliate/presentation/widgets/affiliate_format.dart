import 'package:intl/intl.dart';

/// Money and date formatting for the affiliate surfaces (spec §2.25).
///
/// Two decimals throughout: commission is a fixed ₹ amount per variant and can
/// land on paise (₹18.50 in the design), so rounding to whole rupees would show
/// a balance that doesn't add up. `core/widgets/price_display.dart` formats
/// catalogue prices at 0 decimals, which is why this is separate.
class AffiliateFormat {
  const AffiliateFormat._();

  static final NumberFormat _money = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  /// Digits only, for prefilling the amount field from a quick pill.
  static final NumberFormat _plain = NumberFormat.decimalPattern('en_IN');

  static final DateFormat _date = DateFormat('d MMM yyyy');

  /// "₹1,240.50"
  static String money(num value) => _money.format(value);

  /// "1,240" — no symbol, for an input field that already shows a ₹ prefix.
  static String plain(num value) => _plain.format(value);

  /// "28 Mar 2026", or an em dash when the server timestamp hasn't landed yet.
  static String date(DateTime? value) =>
      value == null ? '—' : _date.format(value);
}
