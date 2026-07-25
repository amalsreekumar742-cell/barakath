import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/error/failures.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/banner_item.dart';
import '../repositories/home_repository.dart';
import 'home_limit.dart';

/// Active App-placed banners for the home carousel, in admin `position` order.
@injectable
class GetBanners implements UseCase<List<BannerItem>, HomeLimit> {
  GetBanners(this._repository);

  final HomeRepository _repository;

  @override
  Future<Either<Failure, List<BannerItem>>> call(HomeLimit params) =>
      _repository.getBanners(limit: params.limit);
}
