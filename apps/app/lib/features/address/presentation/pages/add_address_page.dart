import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_details.dart';
import '../../../../core/constants/indian_states.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/custom_text_field.dart';
import '../../../../core/widgets/phone_country_code_picker.dart';
import '../../domain/entities/address.dart';
import '../providers/address_provider.dart';

/// Add / edit a delivery address (spec §2.14). Pops the saved [Address] so the
/// caller (checkout) can select it immediately.
class AddAddressPage extends StatefulWidget {
  const AddAddressPage({super.key, this.addressId});

  /// Non-null = edit mode.
  final String? addressId;

  @override
  State<AddAddressPage> createState() => _AddAddressPageState();
}

class _AddAddressPageState extends State<AddAddressPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _city = TextEditingController();
  final _pincode = TextEditingController();
  final _landmark = TextEditingController();

  String? _state;
  String _label = 'Home';

  /// Dial code for the delivery contact, stored alongside the number.
  String _phoneCountryCode = AppDetails.initialCountryCodeSelection;
  bool _isDefault = false;
  bool _locating = false;
  Address? _editing;

  bool get _isEdit => widget.addressId != null && widget.addressId!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_isEdit) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _prefill());
    }
  }

  /// Populate from the already-loaded list; if the page was deep-linked the list
  /// may be cold, so fetch first.
  Future<void> _prefill() async {
    final provider = context.read<AddressProvider>();
    if (provider.addresses.isEmpty) await provider.fetchAddresses();
    if (!mounted) return;

    final existing = provider.byId(widget.addressId!);
    if (existing == null) return;
    setState(() {
      _editing = existing;
      _label = existing.label.isEmpty ? 'Home' : existing.label;
      _name.text = existing.fullName;
      _applyStoredPhone(existing.phone);
      _line1.text = existing.addressLine1;
      _line2.text = existing.addressLine2;
      _city.text = existing.city;
      _pincode.text = existing.pincode;
      _landmark.text = existing.landmark;
      _state = IndianStates.canonical(existing.state) ?? existing.state;
      _isDefault = existing.isDefault;
    });
  }

  /// Splits a stored phone like `+91 9502148890` back into its dial code and
  /// local number. Legacy values saved as bare digits keep the default code and
  /// are treated as the local number.
  void _applyStoredPhone(String stored) {
    final trimmed = stored.trim();
    final space = trimmed.indexOf(' ');
    if (trimmed.startsWith('+') && space > 0) {
      _phoneCountryCode = trimmed.substring(0, space).trim();
      _phone.text = trimmed.substring(space + 1).replaceAll(RegExp(r'\D'), '');
    } else {
      _phone.text = trimmed.replaceAll(RegExp(r'\D'), '');
    }
  }

  /// Country-aware phone check: India keeps the strict 10-digit (starts 6-9)
  /// rule; other dial codes have different lengths, so those are length-checked.
  String? _validatePhoneNumber(String digits) {
    if (_phoneCountryCode == AppDetails.initialCountryCodeSelection) {
      return RegExp(r'^[6-9]\d{9}$').hasMatch(digits)
          ? null
          : 'Enter a 10-digit mobile number';
    }
    return (digits.length < 6 || digits.length > 15)
        ? 'Enter a valid mobile number'
        : null;
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _line1, _line2, _city, _pincode, _landmark]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Reverse-geocode the device location into the form. Only fills the fields
  /// the geocoder is reliable about — the customer still writes their own house
  /// and street, which no geocoder gets right.
  Future<void> _useMyLocation() async {
    setState(() => _locating = true);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        if (mounted) AppToast.error(context, 'Turn on location services to use this');
        await Geolocator.openLocationSettings();
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        // The OS won't prompt again — only the settings screen can undo this.
        if (mounted) {
          AppToast.error(context, 'Location is blocked for Barakath. Enable it in Settings.');
        }
        await Geolocator.openAppSettings();
        return;
      }
      if (permission == LocationPermission.denied) {
        if (mounted) AppToast.error(context, 'Location permission denied');
        return;
      }

      // A cold GPS fix indoors can hang indefinitely, which left the button
      // spinning forever. Cap the wait and fall back to the last known fix,
      // which is more than accurate enough to fill in city/state/pincode.
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.medium,
            timeLimit: Duration(seconds: 20),
          ),
        );
      } catch (_) {
        position = await Geolocator.getLastKnownPosition();
      }
      if (position == null) {
        if (mounted) AppToast.error(context, 'Could not get a location fix — try again outdoors');
        return;
      }

      final places =
          await placemarkFromCoordinates(position.latitude, position.longitude);
      if (places.isEmpty) {
        if (mounted) AppToast.error(context, 'Could not find your address');
        return;
      }

      final place = places.first;
      if (!mounted) return;
      setState(() {
        if ((place.locality ?? '').isNotEmpty) _city.text = place.locality!;
        if ((place.postalCode ?? '').isNotEmpty) {
          _pincode.text = place.postalCode!;
        }
        final resolved = IndianStates.canonical(place.administrativeArea ?? '');
        if (resolved != null) _state = resolved;
        if (_line2.text.trim().isEmpty && (place.subLocality ?? '').isNotEmpty) {
          _line2.text = place.subLocality!;
        }
      });
      AppToast.info(context, 'Filled from your location — check and complete it');
    } catch (_) {
      if (mounted) AppToast.error(context, 'Could not get your location');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_state == null || _state!.isEmpty) {
      AppToast.error(context, 'Select your state');
      return;
    }

    final provider = context.read<AddressProvider>();
    final address = Address(
      id: _editing?.id ?? '',
      label: _label,
      fullName: _name.text.trim(),
      // Keep the country with the number so the delivery contact stays dialable.
      phone: '$_phoneCountryCode ${_phone.text.trim()}',
      addressLine1: _line1.text.trim(),
      addressLine2: _line2.text.trim(),
      city: _city.text.trim(),
      state: _state!,
      pincode: _pincode.text.trim(),
      landmark: _landmark.text.trim(),
      // The very first address must be the default, or checkout opens with
      // nothing selected.
      isDefault: _isDefault || provider.addresses.isEmpty,
      createdAt: _editing?.createdAt,
    );

    if (_isEdit) {
      final ok = await provider.updateAddress(address);
      if (!mounted) return;
      if (!ok) {
        AppToast.error(context, provider.error ?? 'Could not save the address');
        return;
      }
      context.pop(address);
      return;
    }

    final saved = await provider.addAddress(address);
    if (!mounted) return;
    if (saved == null) {
      AppToast.error(context, provider.error ?? 'Could not save the address');
      return;
    }
    context.pop(saved);
  }

  @override
  Widget build(BuildContext context) {
    final saving = context.watch<AddressProvider>().isSaving;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_isEdit ? 'Edit address' : 'Add address'),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            OutlinedButton.icon(
              onPressed: _locating ? null : _useMyLocation,
              icon: _locating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.my_location_rounded, size: 18),
              label: Text(_locating ? 'Locating…' : 'Use my location'),
            ),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Address label',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
            Wrap(
              spacing: 8,
              children: [
                for (final option in const ['Home', 'Office', 'Other'])
                  ChoiceChip(
                    label: Text(option),
                    selected: _label == option,
                    onSelected: (_) => setState(() => _label = option),
                    selectedColor: AppColors.brandGreenSubtle,
                    labelStyle: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: _label == option
                          ? AppColors.brandGreen
                          : AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            CustomTextField(
              label: 'Full name',
              controller: _name,
              textInputAction: TextInputAction.next,
              validator: (v) => (v ?? '').trim().length < 2
                  ? 'Enter the recipient\'s name'
                  : null,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Phone number',
              controller: _phone,
              keyboardType: TextInputType.phone,
              maxLength: _phoneCountryCode == AppDetails.initialCountryCodeSelection
                  ? 10
                  : 15,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              prefix: Padding(
                padding: const EdgeInsets.only(left: 8, right: 8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    PhoneCountryCodePicker(
                      initialDialCode: _phoneCountryCode,
                      onChanged: (code) => setState(() => _phoneCountryCode = code),
                      textStyle: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: AppColors.ink,
                      ),
                    ),
                    Container(width: 1, height: 22, color: AppColors.hairline),
                  ],
                ),
              ),
              validator: (v) => _validatePhoneNumber((v ?? '').trim()),
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Address line 1',
              hint: 'House no, building, street',
              controller: _line1,
              validator: (v) =>
                  (v ?? '').trim().length < 5 ? 'Enter the street address' : null,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Address line 2 (optional)',
              hint: 'Area, colony',
              controller: _line2,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'City',
              controller: _city,
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? 'Enter your city' : null,
            ),
            const SizedBox(height: 12),
            _StateDropdown(
              value: _state,
              onChanged: (v) => setState(() => _state = v),
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Pincode',
              controller: _pincode,
              keyboardType: TextInputType.number,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator: (v) =>
                  (v ?? '').trim().length != 6 ? 'Enter a 6-digit pincode' : null,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Landmark (optional)',
              controller: _landmark,
            ),
            const SizedBox(height: 8),
            SwitchListTile.adaptive(
              value: _isDefault,
              onChanged: (v) => setState(() => _isDefault = v),
              contentPadding: EdgeInsets.zero,
              title: const Text(
                'Set as default address',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              activeThumbColor: AppColors.brandGreen,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: saving ? null : _save,
                child: saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.textPrimary),
                      )
                    : const Text('Save address'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StateDropdown extends StatelessWidget {
  const _StateDropdown({required this.value, required this.onChanged});

  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(bottom: 6),
          child: Text(
            'State',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
        ),
        DropdownButtonFormField<String>(
          initialValue: value,
          isExpanded: true,
          decoration: const InputDecoration(hintText: 'Select state'),
          items: [
            for (final state in IndianStates.all)
              DropdownMenuItem(value: state, child: Text(state)),
          ],
          onChanged: onChanged,
        ),
      ],
    );
  }
}
