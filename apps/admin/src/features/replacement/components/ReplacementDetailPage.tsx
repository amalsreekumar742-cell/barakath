import { type FC, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';
import { ReplacementStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import PhotoViewerModal from '@/components/PhotoViewerModal';
import { formatINR } from '@/utils/format';
import { fetchReplacementDetail } from '../api/fetchReplacementDetail';
import { resetReplacementDetail } from '../stores/replacementSlice';
import ReplacementStatusBadge from './ReplacementStatusBadge';
import ApproveReplacementModal from './ApproveReplacementModal';
import RejectReplacementModal from './RejectReplacementModal';

/** Card shell matching the order detail page (white card, radius-xl, warm shadow). */
const Card: FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  children,
  action,
}) => (
  <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[14px] font-bold tracking-tight text-foreground">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const fmtDateTime = (ts: { toDate: () => Date } | null | undefined) =>
  ts ? format(ts.toDate(), 'dd MMM yyyy, hh:mm a') : '—';

/** A label/value row for the info cards. */
const Field: FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="text-[12px] text-muted">{label}</span>
    <span className="text-right text-[13px] font-medium text-foreground">{children}</span>
  </div>
);

/**
 * ReplacementDetailPage (route /replacement/:id) — the full request view + approve/reject controls
 * (spec §1.10). Loads the request plus its original order on mount, clears them on unmount. The action
 * buttons appear ONLY while the request is Pending; approving spawns a free replacement order (whose id
 * then links from the "Replacement Order" card). The customer photos open in the shared PhotoViewer.
 */
const ReplacementDetailPage: FC = () => {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { replacementDetail, detailLoading, detailError } = useAppSelector((s) => s.replacement);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    void dispatch(fetchReplacementDetail(id));
    return () => {
      dispatch(resetReplacementDetail());
    };
  }, [dispatch, id]);

  if (detailLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton height={90} borderRadius={12} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton height={200} borderRadius={12} />
            <Skeleton height={220} borderRadius={12} />
          </div>
          <div className="space-y-4">
            <Skeleton height={150} borderRadius={12} />
            <Skeleton height={160} borderRadius={12} />
          </div>
        </div>
      </div>
    );
  }

  if (detailError || !replacementDetail) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Replacement request not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/replacement')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to replacements
          </button>
        </div>
      </div>
    );
  }

  const { replacement, order } = replacementDetail;
  const isPending = replacement.status === ReplacementStatus.PENDING;
  const isProcessed = replacement.status !== ReplacementStatus.PENDING;
  const isApproved = replacement.status === ReplacementStatus.APPROVED;

  return (
    <div className="p-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate('/replacement')}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-foreground"
      >
        <Icon name="ArrowLeftLine" size={16} /> Back to replacements
      </button>

      {/* Top section */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-[18px] font-extrabold tracking-tight text-foreground">
              #{replacement.id.slice(0, 8)}
            </h1>
            <ReplacementStatusBadge status={replacement.status} large />
          </div>
          <p className="mt-1 text-[13px] text-muted">Requested {fmtDateTime(replacement.createdAt)}</p>
        </div>

        {/* Action area — only for a still-Pending request */}
        {isPending && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setApproveOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-success px-5 py-2.5 text-[14px] font-semibold text-white hover:brightness-95"
            >
              <Icon name="CheckLine" size={16} /> Approve
            </button>
            <button
              type="button"
              onClick={() => setRejectOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-error px-4 py-2.5 text-[14px] font-semibold text-error hover:bg-error-subtle"
            >
              <Icon name="CloseLine" size={16} /> Reject
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Product */}
          <Card title="Product">
            <div className="flex gap-4">
              <div className="h-[120px] w-[120px] shrink-0 overflow-hidden rounded-xl border border-border bg-subtle">
                {replacement.productImage ? (
                  <img src={replacement.productImage} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[15px] font-bold text-foreground">{replacement.productName}</p>
                <div className="flex items-center gap-1.5 text-[13px] text-muted">
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundColor: replacement.variantColor }}
                  />
                  {replacement.variantName}
                </div>
                <p className="text-[13px] text-muted">
                  Quantity: <span className="font-semibold text-foreground">{replacement.quantity}</span>
                </p>
              </div>
            </div>
          </Card>

          {/* Customer reason + photos */}
          <Card title="Customer reason">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">
              {replacement.reason || '—'}
            </p>
            {replacement.photos.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-muted">
                  Photos ({replacement.photos.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {replacement.photos.map((photo, i) => (
                    <button
                      key={`${photo}-${i}`}
                      type="button"
                      onClick={() => setViewerIndex(i)}
                      className="h-20 w-20 overflow-hidden rounded-lg border border-border bg-subtle transition-opacity hover:opacity-80"
                    >
                      <img src={photo} alt={`Customer photo ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Admin note — shown once processed */}
          {isProcessed && (
            <Card title="Admin note">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">
                {replacement.adminNote || '—'}
              </p>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Request information */}
          <Card title="Request information">
            <div className="space-y-2.5">
              <Field label="Request ID">
                <span className="font-mono text-[12px]">{replacement.id}</span>
              </Field>
              <Field label="Status">
                <ReplacementStatusBadge status={replacement.status} />
              </Field>
              <Field label="Submitted">{fmtDateTime(replacement.createdAt)}</Field>
              {isProcessed && <Field label="Processed">{fmtDateTime(replacement.processedAt)}</Field>}
              {isProcessed && replacement.processedByName && (
                <Field label="Processed by">{replacement.processedByName}</Field>
              )}
            </div>
          </Card>

          {/* Customer */}
          <Card title="Customer">
            <button
              type="button"
              onClick={() => navigate(`/customers/${replacement.userId}`)}
              className="block w-full text-left"
            >
              <p className="text-[13px] font-semibold text-primary hover:underline">{replacement.userName}</p>
              <p className="mt-1 text-[13px] text-muted">{replacement.userPhone}</p>
              <p className="text-[13px] text-muted">{replacement.userEmail}</p>
            </button>
          </Card>

          {/* Original order reference */}
          <Card title="Original order">
            {order ? (
              <div className="space-y-2.5">
                <Field label="Order ID">
                  <button
                    type="button"
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="font-mono text-[12px] font-semibold text-primary hover:underline"
                  >
                    #{order.id.slice(0, 8)}
                  </button>
                </Field>
                <Field label="Placed">{fmtDateTime(order.createdAt)}</Field>
                <Field label="Status">
                  <OrderStatusBadge status={order.status} />
                </Field>
                <Field label="Grand total">{formatINR(order.grandTotal)}</Field>
              </div>
            ) : (
              <p className="text-[13px] text-muted">
                Original order <span className="font-mono">#{replacement.orderId.slice(0, 8)}</span> is no
                longer available.
              </p>
            )}
          </Card>

          {/* Replacement order — only once approved and linked */}
          {isApproved && replacement.replacementOrderId && (
            <Card title="Replacement order">
              <button
                type="button"
                onClick={() => navigate(`/orders/${replacement.replacementOrderId}`)}
                className="font-mono text-[13px] font-semibold text-primary hover:underline"
              >
                #{replacement.replacementOrderId.slice(0, 8)}
              </button>
              <p className="mt-1.5 text-[12px] text-muted">
                A free replacement order was created and starts a fresh order flow.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Modals */}
      <ApproveReplacementModal
        isOpen={approveOpen}
        replacementId={replacement.id}
        onClose={() => setApproveOpen(false)}
        onApproved={() => dispatch(fetchReplacementDetail(replacement.id))}
      />
      <RejectReplacementModal
        isOpen={rejectOpen}
        replacementId={replacement.id}
        onClose={() => setRejectOpen(false)}
        onRejected={() => dispatch(fetchReplacementDetail(replacement.id))}
      />
      <PhotoViewerModal
        isOpen={viewerIndex !== null}
        photos={replacement.photos}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
};

export default ReplacementDetailPage;
