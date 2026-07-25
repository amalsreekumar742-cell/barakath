import { type FC, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { fetchSubAdminDetail } from '../api/fetchSubAdminDetail';
import { resetSubAdminDetail } from '../stores/subAdminSlice';
import SubAdminForm from './SubAdminForm';

/**
 * EditSubAdminPage — route /sub-admin/:id/edit (spec §1.20 editable after creation). Fetches the sub-admin
 * on mount, shows a skeleton while loading, then renders the shared SubAdminForm in "edit" mode (which
 * hydrates from the loaded doc). WHY fetch here (not in the form): the route owns the load + loading/error
 * state so the form stays reusable by Create too.
 */
const EditSubAdminPage: FC = () => {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { detail, detailLoading, detailError } = useAppSelector((s) => s.subAdmin);

  useEffect(() => {
    if (id) void dispatch(fetchSubAdminDetail(id));
    return () => {
      dispatch(resetSubAdminDetail());
    };
  }, [dispatch, id]);

  if (detailLoading || (!detail && !detailError)) {
    return (
      <div className="p-6">
        <Skeleton height={40} width={260} />
        <div className="mt-4 grid max-w-5xl gap-4 lg:grid-cols-2">
          <Skeleton height={340} borderRadius={16} />
          <Skeleton height={340} borderRadius={16} />
        </div>
      </div>
    );
  }

  if (detailError || !detail) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Sub-admin not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/sub-admin')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to sub admins
          </button>
        </div>
      </div>
    );
  }

  // Key on the id so the form fully re-hydrates if the admin navigates between two edit pages.
  return <SubAdminForm key={detail.id} mode="edit" subAdmin={detail} />;
};

export default EditSubAdminPage;
