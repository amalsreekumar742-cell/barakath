import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/constants/domain_enums.dart';
import '../../domain/entities/replacement.dart';
import '../../domain/entities/replacement_draft.dart';
import '../../domain/usecases/submit_replacement_request.dart';

/// Explicit, named form states (skill rule).
enum ReplacementFormState { editing, submitting, submitted, error }

/// Replacement request form: reason, description, photos, submit (spec §2.18).
///
/// The form holds its own validity so the page's submit button and the
/// confirmation dialog agree on what "complete" means.
@injectable
class ReplacementProvider extends ChangeNotifier {
  ReplacementProvider(this._submitRequest);

  final SubmitReplacementRequest _submitRequest;

  /// "Describe the issue" minimum, mirroring the review-text rule in §2.24.
  static const int minDescriptionLength = 10;

  /// Spec §2.18 requires at least one photo; five is the upload grid's cap.
  static const int minPhotos = 1;
  static const int maxPhotos = 5;

  ReplacementFormState _state = ReplacementFormState.editing;
  ReplacementReason? _reason;
  String _description = '';
  List<File> _photos = const [];
  String? _error;
  Replacement? _submitted;

  ReplacementFormState get state => _state;
  ReplacementReason? get reason => _reason;
  String get description => _description;
  List<File> get photos => List.unmodifiable(_photos);
  String? get error => _error;
  Replacement? get submitted => _submitted;
  bool get isSubmitting => _state == ReplacementFormState.submitting;

  bool get hasReason => _reason != null;
  bool get hasDescription => _description.trim().length >= minDescriptionLength;
  bool get hasPhotos => _photos.length >= minPhotos;

  /// All three §2.18 requirements met — the submit button's enabled state.
  bool get canSubmit => hasReason && hasDescription && hasPhotos;

  /// Wipe the form. Called when the page opens so a previous request's answers
  /// never bleed into the next one (the provider is app-wide).
  void reset() {
    _state = ReplacementFormState.editing;
    _reason = null;
    _description = '';
    _photos = const [];
    _error = null;
    _submitted = null;
    notifyListeners();
  }

  void selectReason(ReplacementReason reason) {
    _reason = reason;
    notifyListeners();
  }

  void setDescription(String value) {
    _description = value;
    notifyListeners();
  }

  void setPhotos(List<File> photos) {
    _photos = photos.take(maxPhotos).toList();
    notifyListeners();
  }

  /// Create the request. Returns null on success, else the message to toast.
  Future<String?> submit({
    required String orderId,
    required String userName,
    required String userPhone,
    required String userEmail,
    required String productId,
    required String productName,
    required String productImage,
    required String variantId,
    required String variantName,
    required String variantColor,
    required int quantity,
  }) async {
    if (!canSubmit) return 'Please complete every field first.';

    _state = ReplacementFormState.submitting;
    _error = null;
    notifyListeners();

    final result = await _submitRequest(
      ReplacementDraft(
        orderId: orderId,
        userName: userName,
        userPhone: userPhone,
        userEmail: userEmail,
        productId: productId,
        productName: productName,
        productImage: productImage,
        variantId: variantId,
        variantName: variantName,
        variantColor: variantColor,
        quantity: quantity,
        reason: _reason!.label,
        description: _description,
        photos: _photos,
      ),
    );

    String? message;
    result.fold(
      (failure) {
        _error = failure.message;
        _state = ReplacementFormState.error;
        message = failure.message;
      },
      (replacement) {
        _submitted = replacement;
        _state = ReplacementFormState.submitted;
      },
    );
    notifyListeners();
    return message;
  }
}
