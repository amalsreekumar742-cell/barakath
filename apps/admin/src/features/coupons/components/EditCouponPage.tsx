import { type FC, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { fetchCouponDetail } from '../api/fetchCouponDetail';
import { resetCouponDetail } from '../stores/couponsSlice';
import CouponForm from './CouponForm';

/**
 * EditCouponPage — route /coupons/:id/edit (spec §1.12 editable after creation). Fetches the coupon on
 * mount, shows a skeleton while loading, then renders the shared CouponForm in "edit" mode (which hydrates
 * from the loaded coupon). WHY fetch here (not in the form): the form is presentational over a ready
 * coupon; the route owns the load + loading/error state so the form stays reusable by Create too.
 */
const EditCouponPage: FC = () => {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { couponDetail, detailLoading, detailError } = useAppSelector((s) => s.coupons);

  useEffect(() => {
    if (id) void dispatch(fetchCouponDetail(id));
    return () => {
      dispatch(resetCouponDetail());
    };
  }, [dispatch, id]);

  if (detailLoading || (!couponDetail && !detailError)) {
    return (
      <div className="p-6">
        <Skeleton height={40} width={260} />
        <Skeleton height={180} className="mt-4" borderRadius={16} />
        <Skeleton height={220} className="mt-4" borderRadius={16} />
      </div>
    );
  }

  if (detailError || !couponDetail) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Coupon not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/coupons')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to coupons
          </button>
        </div>
      </div>
    );
  }

  // Key on the coupon id so the form fully re-hydrates if the admin navigates between two edit pages.
  return <CouponForm key={couponDetail.id} mode="edit" coupon={couponDetail} />;
};

export default EditCouponPage;
