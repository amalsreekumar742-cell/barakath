import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import type { BannerProps } from '@barakath/shared/types';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { fetchBanners } from '../api/fetchBanners';
import { deleteBanner } from '../api/deleteBanner';

/** Sub-label under a card: "{ratio} · attached: {product}" when a product is linked, else just the ratio. */
function attachedLabel(b: BannerProps): string {
  const ratio = b.placement === 'Website' ? '3:1' : '16:9';
  if (b.linkType === 'Product' && b.linkProductName) return `${ratio} · attached: ${b.linkProductName}`;
  return ratio;
}

/**
 * BannersPage — the banner list (spec §1.15 / prototype "Growth › Banner"): a single 3-column CARD grid.
 * Each card is the 16:9 image, the title with a Live/Draft status pill, an "16:9 · attached: {product}"
 * line and a delete ✕; clicking the card opens its edit page. The list stays cursor-paginated (View More)
 * with skeleton/empty states. WHY no filters/badges/reorder: the prototype's banner screen is a plain card
 * grid — it shows only the image, title, Live/Draft and delete.
 */
const BannersPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { banners, hasMore, loading, loadingMore, error, lastVisible, filters } = useAppSelector(
    (s) => s.banners,
  );

  useEffect(() => {
    void dispatch(fetchBanners({ filters, cursor: null }));
  }, [dispatch, filters]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Banner</h1>
          <p className="mt-1.5 text-[13px] text-muted">Multiple banners · aspect ratio 16:9</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/banners/add')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark"
        >
          <Icon name="AddLine" size={16} /> Add banner
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-3.5">
              <Skeleton className="aspect-video" borderRadius={8} />
              <div className="mt-3">
                <Skeleton height={16} width="60%" />
                <Skeleton height={12} width="40%" className="mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{error}</p>
          <button
            type="button"
            onClick={() => dispatch(fetchBanners({ filters, cursor: null }))}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Retry
          </button>
        </div>
      ) : banners.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary-subtle text-primary">
            <Icon name="ImageLine" size={28} />
          </div>
          <h2 className="text-[16px] font-bold text-foreground">No banners yet</h2>
          <button
            type="button"
            onClick={() => navigate('/banners/add')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="AddLine" size={16} /> Add your first banner
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banners.map((b) => (
              <BannerCard key={b.id} banner={b} />
            ))}
          </div>

          {loadingMore && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={220} borderRadius={12} />
              ))}
            </div>
          )}
          {hasMore && !loadingMore && (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={() => dispatch(fetchBanners({ filters, cursor: lastVisible }))}
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
 * BannerCard — one banner tile (spec §1.15). Clicking the card opens its edit page; the delete ✕ is
 * confirmed with a dialog (spec §1.22) and stops propagation so it never also navigates. The status pill
 * reads Live (active) / Draft (inactive) per the prototype.
 */
const BannerCard: FC<{ banner: BannerProps }> = ({ banner }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const deleteLoading = useAppSelector((s) => s.banners.deleteLoading);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onDelete = async () => {
    const res = await dispatch(deleteBanner(banner.id));
    setConfirmDelete(false);
    if (deleteBanner.fulfilled.match(res)) toast.success('Banner deleted');
    else toast.error((res.payload as string) ?? 'Could not delete banner');
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/banners/${banner.id}/edit`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/banners/${banner.id}/edit`);
      }}
      className="cursor-pointer rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-colors hover:border-border-strong"
    >
      {/* Image (16:9) */}
      <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-subtle">
        <img src={banner.image} alt={banner.title} className="h-full w-full object-cover" />
      </div>

      {/* Title + status */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[13px] font-bold text-foreground">{banner.title}</h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-[11px] font-bold ${
            banner.isActive ? 'bg-success-subtle text-success' : 'bg-subtle text-muted'
          }`}
        >
          {banner.isActive ? 'Live' : 'Draft'}
        </span>
      </div>

      {/* Attached + delete */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-faint">{attachedLabel(banner)}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          aria-label="Delete banner"
          className="inline-flex shrink-0 rounded-md p-1 text-muted hover:bg-error-subtle hover:text-error"
        >
          <Icon name="CloseLine" size={16} />
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete banner?"
        message={`This permanently deletes "${banner.title}" and its image. This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteLoading}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default BannersPage;
