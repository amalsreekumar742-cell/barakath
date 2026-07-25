import 'package:equatable/equatable.dart';

/// How many rows a home section asks for. Shared by every section use case —
/// the home screen is a teaser of each list, so the count is the only knob.
class HomeLimit extends Equatable {
  const HomeLimit(this.limit);

  /// Banner strip default — a carousel the customer swipes through.
  static const HomeLimit banners = HomeLimit(6);

  /// Category strip default (spec §2.6 "Shop by category" + "See all").
  static const HomeLimit categories = HomeLimit(10);

  /// Product row default — one screenful of a horizontal row / a 2x3 grid.
  static const HomeLimit products = HomeLimit(6);

  /// How many products each per-category row on home shows. Deliberately
  /// smaller than [products]: these rows are a taste of the category, and the
  /// "See all" beside the title is how the customer gets the rest.
  static const HomeLimit categoryProducts = HomeLimit(4);

  final int limit;

  @override
  List<Object?> get props => [limit];
}
