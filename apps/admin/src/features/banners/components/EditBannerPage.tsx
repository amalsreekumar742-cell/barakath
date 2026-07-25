import { type FC, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import { fetchBannerDetail } from '../api/fetchBannerDetail';
import { resetBannerDetail } from '../stores/bannersSlice';
import BannerForm from './BannerForm';

/**
 * EditBannerPage — route /banners/:id/edit (spec §1.15 click card to edit). Fetches the banner detail on
 * mount, shows a skeleton while loading and an error state with retry, then renders the shared BannerForm
 * hydrated with the loaded banner. WHY reset on unmount: clears the stale detail so a later Edit of a
 * different banner never flashes the previous one.
 */
const EditBannerPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { bannerDetail, detailLoading, detailError } = useAppSelector((s) => s.banners);

  useEffect(() => {
    if (id) void dispatch(fetchBannerDetail(id));
    return () => {
      dispatch(resetBannerDetail());
    };
  }, [dispatch, id]);

  if (detailLoading || (!bannerDetail && !detailError)) {
    return (
      <div className="max-w-3xl space-y-4 p-6">
        <Skeleton height={32} width={220} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={120} borderRadius={12} />
        ))}
      </div>
    );
  }

  if (detailError || !bannerDetail) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-error-subtle text-error">
            <Icon name="AlertLine" size={28} />
          </div>
          <p className="text-[14px] text-muted">{detailError ?? 'Banner not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/banners')}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to banners
          </button>
        </div>
      </div>
    );
  }

  return <BannerForm mode="edit" banner={bannerDetail} />;
};

export default EditBannerPage;
