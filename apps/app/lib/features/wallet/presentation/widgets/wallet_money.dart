import 'package:intl/intl.dart';

/// Money + date formatting for the wallet surfaces.
///
/// WHY a wallet-local helper and not `core/widgets/price_display.dart`: that one
/// is a widget and rounds to whole rupees (catalogue prices). A ledger is
/// accounting — the design renders `₹24.00` / `+₹500.00`, so paise are shown.
/// Lives here because `lib/core/` is owned by another session.
class WalletMoney {
  const WalletMoney._();

  static final NumberFormat _rupees = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 2,
  );

  /// Indian-grouped rupees with paise — `₹1,24,500.00`.
  static String format(double amount) => _rupees.format(amount);

  /// A signed ledger amount: `+₹500.00` for a credit, `−₹24.00` for a debit.
  /// The minus is U+2212 MINUS SIGN, not a hyphen — it aligns with the digits.
  static String signed(double amount, {required bool isCredit}) =>
      '${isCredit ? '+' : '−'}${_rupees.format(amount.abs())}';

  /// Whole rupees for a button label / quick pill — `₹1,000`.
  static String whole(double amount) => NumberFormat.currency(
        locale: 'en_IN',
        symbol: '₹',
        decimalDigits: 0,
      ).format(amount);

  static final DateFormat _date = DateFormat('d MMM yyyy');

  /// Ledger row timestamp. Today's entries read "Today" like the prototype;
  /// everything older gets an unambiguous date rather than "3 days ago".
  static String date(DateTime? value) {
    if (value == null) return '';
    final now = DateTime.now();
    final isToday = value.year == now.year &&
        value.month == now.month &&
        value.day == now.day;
    if (isToday) return 'Today';
    final yesterday = now.subtract(const Duration(days: 1));
    final isYesterday = value.year == yesterday.year &&
        value.month == yesterday.month &&
        value.day == yesterday.day;
    if (isYesterday) return 'Yesterday';
    return _date.format(value);
  }
}
