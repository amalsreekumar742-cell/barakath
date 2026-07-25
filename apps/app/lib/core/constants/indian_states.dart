/// The 28 states + 8 union territories, for the address form's State dropdown
/// (spec §2.14). India-only storefront, so this is a fixed list rather than a
/// lookup — it changes about once a decade.
class IndianStates {
  const IndianStates._();

  static const List<String> all = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    // Union Territories
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry',
  ];

  /// Reverse-geocoding returns free-text that rarely matches our list exactly
  /// ("NCT of Delhi", "Orissa"). Map it to a canonical entry so the dropdown can
  /// actually select it — an unmatched value would silently reset to null.
  static String? canonical(String raw) {
    final needle = raw.trim().toLowerCase();
    if (needle.isEmpty) return null;
    for (final state in all) {
      if (state.toLowerCase() == needle) return state;
    }
    const aliases = <String, String>{
      'nct of delhi': 'Delhi',
      'national capital territory of delhi': 'Delhi',
      'new delhi': 'Delhi',
      'orissa': 'Odisha',
      'pondicherry': 'Puducherry',
      'uttaranchal': 'Uttarakhand',
    };
    return aliases[needle];
  }
}
