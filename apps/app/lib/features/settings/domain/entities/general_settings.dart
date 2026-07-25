import 'package:equatable/equatable.dart';

/// A single delivery-fee tier. `general/config` stores no explicit slab table —
/// slabs are derived from `standardDeliveryFee` + `freeDeliveryThreshold` (see
/// [GeneralSettings.deliverySlabs]) so screens iterate a uniform list.
class DeliverySlab extends Equatable {
  const DeliverySlab({
    required this.minAmount,
    required this.maxAmount,
    required this.fee,
  });

  /// Inclusive lower bound of the order-subtotal range (₹).
  final double minAmount;

  /// Exclusive upper bound (₹); null means "and above".
  final double? maxAmount;

  /// Delivery fee applied within this range (₹).
  final double fee;

  @override
  List<Object?> get props => [minAmount, maxAmount, fee];
}

/// The `general/config` settings document (spec §1.21) as a pure domain entity.
///
/// The app reads the slices it needs for checkout math (delivery/GST), payment
/// (Razorpay) and the legal/help screens. Money/counter maps are server-owned.
class GeneralSettings extends Equatable {
  const GeneralSettings({
    required this.standardDeliveryFee,
    required this.freeDeliveryThreshold,
    required this.gstPercentage,
    required this.gstin,
    required this.pricesIncludeTax,
    required this.razorpayKeyId,
    required this.razorpayConnected,
    required this.walletPaymentsEnabled,
    required this.privacyPolicy,
    required this.termsAndConditions,
    required this.privacyPolicyUpdatedAt,
    required this.termsUpdatedAt,
    required this.helpPhone,
    required this.helpWhatsApp,
    required this.helpEmail,
    required this.appMinVersion,
    required this.appLatestVersion,
    required this.updatedAt,
  });

  // delivery map
  final double standardDeliveryFee;
  final double freeDeliveryThreshold;
  final double gstPercentage;
  final String gstin;
  final bool pricesIncludeTax;

  // payment map
  final String razorpayKeyId;
  final bool razorpayConnected;
  final bool walletPaymentsEnabled;

  // privacy / terms maps
  final String privacyPolicy;
  final String termsAndConditions;
  final DateTime? privacyPolicyUpdatedAt;
  final DateTime? termsUpdatedAt;

  // contactus map
  final String helpPhone;
  final String helpWhatsApp;
  final String helpEmail;

  // app version (not in schema — defaulted)
  final String appMinVersion;
  final String appLatestVersion;

  final DateTime? updatedAt;

  /// Safe empty defaults — used before the first load / on a read failure so
  /// convenience getters never null-crash checkout math.
  static const empty = GeneralSettings(
    standardDeliveryFee: 0,
    freeDeliveryThreshold: 0,
    gstPercentage: 0,
    gstin: '',
    pricesIncludeTax: false,
    razorpayKeyId: '',
    razorpayConnected: false,
    walletPaymentsEnabled: false,
    privacyPolicy: '',
    termsAndConditions: '',
    privacyPolicyUpdatedAt: null,
    termsUpdatedAt: null,
    helpPhone: '',
    helpWhatsApp: '',
    helpEmail: '',
    appMinVersion: '1.0.0',
    appLatestVersion: '1.0.0',
    updatedAt: null,
  );

  /// Derived delivery slabs. No explicit slab table exists in `general/config`,
  /// so there is exactly one band: the standard fee, at every order value.
  ///
  /// The free-delivery waiver is deliberately NOT encoded here. It used to be —
  /// a second `[threshold .. ∞) → fee 0` band — which made
  /// `CartProvider.baseDeliveryCharge` return 0 above the threshold even though
  /// that getter exists precisely to report the fee BEFORE the waiver. The knock
  /// -on was that `hasFreeDelivery` (which requires `baseDeliveryCharge > 0`)
  /// could never be true, so the bag never showed the struck-through "was ₹X"
  /// beside FREE and the saving was invisible. The waiver belongs to the charge
  /// calculation, not to the rate table.
  List<DeliverySlab> get deliverySlabs =>
      [DeliverySlab(minAmount: 0, maxAmount: null, fee: standardDeliveryFee)];

  @override
  List<Object?> get props => [
        standardDeliveryFee,
        freeDeliveryThreshold,
        gstPercentage,
        gstin,
        pricesIncludeTax,
        razorpayKeyId,
        razorpayConnected,
        walletPaymentsEnabled,
        privacyPolicy,
        termsAndConditions,
        privacyPolicyUpdatedAt,
        termsUpdatedAt,
        helpPhone,
        helpWhatsApp,
        helpEmail,
        appMinVersion,
        appLatestVersion,
        updatedAt,
      ];
}
