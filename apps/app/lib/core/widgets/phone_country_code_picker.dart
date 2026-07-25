import 'package:country_code_picker/country_code_picker.dart';
import 'package:flutter/material.dart';

import '../constants/app_details.dart';

/// The app's phone country-code selector — a thin wrapper over
/// [CountryCodePicker] so login and the address form present one identical
/// control. Reports the chosen dial code (e.g. `+91`) via [onChanged]; the
/// caller keeps that string and threads it wherever the phone is sent/stored.
class PhoneCountryCodePicker extends StatelessWidget {
  const PhoneCountryCodePicker({
    super.key,
    required this.onChanged,
    this.initialDialCode = AppDetails.initialCountryCodeSelection,
    this.textStyle,
  });

  /// Starting dial code — `+91` unless an edited value overrides it.
  final String initialDialCode;

  /// Fires with the selected dial code, never null (falls back to
  /// [initialDialCode] if the package ever hands back a null dialCode).
  final ValueChanged<String> onChanged;

  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    return CountryCodePicker(
      onChanged: (code) => onChanged(code.dialCode ?? initialDialCode),
      initialSelection: initialDialCode,
      // India first — the overwhelming majority of customers — then the picker
      // still lets anyone scroll/search to their own code.
      favorite: const ['+91', 'IN'],
      showFlag: true,
      showFlagMain: true,
      showDropDownButton: true,
      // The wrapping field owns the outer padding, so the control hugs its
      // content and lines up with the number beside it.
      padding: EdgeInsets.zero,
      flagWidth: 22,
      textStyle: textStyle,
    );
  }
}
