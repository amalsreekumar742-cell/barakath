import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { SpinnerCampaignProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchCampaigns } from '../api/fetchCampaigns';
import { deleteCampaign } from '../api/deleteCampaign';
import { StatusBadge } from './ui';

/** Win rate (conversion) as an integer percentage — 0 when there have been no spins. */
const winRate = (c: SpinnerCampaignProps): number =>
  c.totalSpins > 0 ? Math.round((c.totalWins / c.totalSpins) * 100) : 0;

/** Count of active (running) campaigns for the header subtitle. */
const isActiveNow = (c: SpinnerCampaignProps): boolean => c.isActive && c.endDate.toMillis() > Date.now();

/**
 * SpinnerCampaignsPage — the campaign list (spec F13), rendered as the design's 3-column CARD GRID: each
 * card shows the campaign name + computed status pill up top and Plays / Conversion (with a delete ✕) at
 * the bottom, and opens the campaign's configure page on click. Header carries the collection-wide count
 * and the "+ Create campaign" action; the list stays cursor-paginated (View More) with skeleton/empty
 * states. WHY cards over a table: the prototype's spinner list is a card grid, not a data table.
 */
const SpinnerCampaignsPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { campaigns, hasMore, loading, loadingMore, error, lastVisible, filters } =
    useAppSelector((s) => s.spinnerCampaigns);

  useEffect(() => {
    void dispatch(fetchCampaigns({ filters, cursor: null }));
  }, [dispatch, filters]);

  const activeCount = campaigns.filter(isActiveNow).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Spinner campaigns</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            {activeCount} active · reward config &amp; probability
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/spinner-campaigns/create')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Create campaign
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={132} borderRadius={12} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchCampaigns({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="GiftLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No campaigns yet</h2>
          <button
            type="button"
            onClick={() => navigate('/spinner-campaigns/create')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Create your first campaign
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>

          {loadingMore && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={132} borderRadius={12} />
              ))}
            </div>
          )}
          {hasMore && !loadingMore && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => dispatch(fetchCampaigns({ filters, cursor: lastVisible }))}
                className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
              >
                View More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * CampaignCard — one campaign tile in the grid (spec F13 list). Clicking the card opens its configure page;
 * the delete ✕ is confirmed with a dialog (spec §1.22) and stops propagation so it never also navigates.
 * Plays = totalSpins, Conversion = win rate; both show "—" before any spins so an empty campaign reads
 * clean (matching the prototype's Scheduled card).
 */
const CampaignCard: FC<{ campaign: SpinnerCampaignProps }> = ({ campaign }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deleteLoading = useAppSelector((s) => s.spinnerCampaigns.deleteLoading);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const plays = campaign.totalSpins > 0 ? campaign.totalSpins.toLocaleString('en-IN') : '—';
  const conversion = campaign.totalSpins > 0 ? `${winRate(campaign)}%` : '—';

  const onDelete = async () => {
    const res = await dispatch(deleteCampaign(campaign.id));
    setConfirmDelete(false);
    if (deleteCampaign.fulfilled.match(res)) toast.success('Campaign deleted');
    else toast.error((res.payload as string) ?? 'Could not delete campaign');
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/spinner-campaigns/${campaign.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/spinner-campaigns/${campaign.id}`);
      }}
      className="cursor-pointer rounded-xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-border-strong"
    >
      {/* Name + status */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="truncate text-[14px] font-bold text-foreground">{campaign.name}</span>
        <StatusBadge campaign={campaign} />
      </div>

      {/* Stats + delete */}
      <div className="flex items-end gap-5">
        <div>
          <p className="text-[11px] font-medium text-faint">Plays</p>
          <p className="mt-1.5 text-[18px] font-extrabold tabular-nums text-foreground">{plays}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-faint">Conversion</p>
          <p className="mt-1.5 text-[18px] font-extrabold tabular-nums text-foreground">{conversion}</p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          aria-label="Delete campaign"
          className="order-2 ml-auto inline-flex rounded-md p-1.5 text-muted hover:bg-error-subtle hover:text-error"
        >
          <Icon name="CloseLine" size={18} />
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete campaign?"
        message={`This permanently deletes "${campaign.name}". This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default SpinnerCampaignsPage;
