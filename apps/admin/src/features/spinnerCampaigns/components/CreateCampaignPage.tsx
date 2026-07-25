import { type FC, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import { fetchCampaignDetail } from '../api/fetchCampaignDetail';
import { resetCampaignDetail } from '../stores/spinnerCampaignsSlice';
import CampaignForm from './CampaignForm';

/**
 * CreateCampaignPage — route /spinner-campaigns/create (spec F13). Doubles as the Edit page via an
 * `?edit=<id>` query param: when present it loads that campaign and renders CampaignForm in "edit" mode
 * (Update Campaign + updateCampaign); otherwise it renders a blank form in "create" mode.
 *
 * WHY one route for both: Edit reuses the identical form + validation, so keying it off a query param
 * avoids a second near-duplicate page and keeps the "Edit → /spinner-campaigns/create?edit=<id>" link the
 * detail page uses working, while the static "create" segment stays registered before the dynamic ":id".
 */
const CreateCampaignPage: FC = () => {
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { campaignDetail, detailLoading, detailError } = useAppSelector((s) => s.spinnerCampaigns);

  // In edit mode, load the campaign to prefill; clear it on unmount so stale data never leaks.
  useEffect(() => {
    if (!editId) return;
    void dispatch(fetchCampaignDetail(editId));
    return () => {
      dispatch(resetCampaignDetail());
    };
  }, [dispatch, editId]);

  // Plain create — no fetch needed.
  if (!editId) return <CampaignForm mode="create" />;

  if (detailLoading || (!campaignDetail && !detailError)) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton height={32} width={240} borderRadius={8} />
        <Skeleton height={160} borderRadius={12} />
        <Skeleton height={220} borderRadius={12} />
      </div>
    );
  }

  if (detailError || !campaignDetail) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Campaign not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/spinner-campaigns')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to campaigns
          </button>
        </div>
      </div>
    );
  }

  // Remount the form when the target id changes so its internal defaults re-hydrate cleanly.
  return <CampaignForm key={campaignDetail.id} mode="edit" campaign={campaignDetail} />;
};

export default CreateCampaignPage;
