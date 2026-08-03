import { type FC, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { OrderProps, OrderStatusTimelineEntry } from '@barakath/shared/types';
import { OrderStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Icon from '@/components/icons/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { formatINR } from '@/utils/format';
import { fetchOrderDetail } from '../api/fetchOrderDetail';
import { updateOrderStatus } from '../api/updateOrderStatus';
import { resetOrderDetail } from '../stores/ordersSlice';
import {
  FLOW_STEPS,
  nextStatus,
  nextActionLabel,
  canCancel,
  isStepComplete,
  isOrderPaid,
  unpaidAdvanceReason,
} from '../utils/orderFlow';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentBadges';
import ShipmentModal from './ShipmentModal';
import CancelOrderModal from './CancelOrderModal';

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

const flowIndex = (s: string) => FLOW_STEPS.indexOf(s as (typeof FLOW_STEPS)[number]);

/**
 * OrderDetailPage — full order view + sequential status control (spec §1.7). The action area shows only
 * the single next valid step (never a dropdown): advancing runs a confirm; Ship opens the shipment
 * form; Cancel (Pending only) opens the cancel form. Timeline, items, payment and tracking read off the
 * one order doc.
 */
const OrderDetailPage: FC = () => {
  const { id = '' } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { orderDetail, detailLoading, detailError, updateStatusLoading } = useAppSelector(
    (s) => s.orders,
  );

  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    void dispatch(fetchOrderDetail(id));
    return () => {
      dispatch(resetOrderDetail());
    };
  }, [dispatch, id]);

  const order = orderDetail;

  const advance = async () => {
    if (!order) return;
    const next = nextStatus(order.status);
    if (!next) return;
    const res = await dispatch(updateOrderStatus({ orderId: order.id, newStatus: next }));
    setConfirmAdvance(false);
    if (updateOrderStatus.fulfilled.match(res)) toast.success(`Order status updated to ${next}`);
    else toast.error((res.payload as string) ?? 'Could not update status');
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Could not copy'),
    );
  };

  if (detailLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton height={90} borderRadius={12} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton height={220} borderRadius={12} />
            <Skeleton height={200} borderRadius={12} />
          </div>
          <div className="space-y-4">
            <Skeleton height={130} borderRadius={12} />
            <Skeleton height={180} borderRadius={12} />
          </div>
        </div>
      </div>
    );
  }

  if (detailError || !order) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-border bg-surface p-10 text-center">
          <p className="text-[14px] text-muted">{detailError ?? 'Order not found'}</p>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            Back to orders
          </button>
        </div>
      </div>
    );
  }

  const action = nextActionLabel(order.status);
  // Stock is reserved at checkout, before payment, and only dailyCleanup (which matches orders still
  // at status 'Pending') gives it back. Advancing an unpaid order strands that stock for good and
  // ships goods nobody paid for — so the advance button is disabled with the reason spelled out.
  // Cancel stays enabled: it is the correct way to release an abandoned checkout.
  const paid = isOrderPaid(order.paymentStatus);
  const blockedReason = paid ? null : unpaidAdvanceReason(order.paymentStatus);
  const shippedOrLater = flowIndex(order.status) >= flowIndex(OrderStatus.SHIPPED);
  const timelineByStatus = new Map<string, OrderStatusTimelineEntry>(
    (order.statusTimeline ?? []).map((e) => [e.status, e]),
  );
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const cancelledEntry = timelineByStatus.get(OrderStatus.CANCELLED);

  return (
    <div className="p-6">
      {/* Top section */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-[18px] font-extrabold tracking-tight text-foreground">
              #{order.id}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-[13px] text-muted">Placed {fmtDateTime(order.createdAt)}</p>
        </div>

        {/* Status action area — single next step only */}
        <div className="flex flex-wrap items-center gap-2">
          {order.status === OrderStatus.DELIVERED && (
            <button
              type="button"
              onClick={() => toast('Invoice generation coming soon')}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-[14px] font-semibold text-foreground hover:bg-subtle"
            >
              <Icon name="ArrowDownLine" size={16} /> Download Invoice
            </button>
          )}
          {action && (
            <button
              type="button"
              disabled={updateStatusLoading || !paid}
              title={blockedReason ?? undefined}
              onClick={() =>
                order.status === OrderStatus.PACKED ? setShipOpen(true) : setConfirmAdvance(true)
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateStatusLoading && <Icon name="Loader4Line" size={16} className="animate-spin" />}
              {action}
            </button>
          )}
          {canCancel(order.status) && (
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-error px-4 py-2.5 text-[14px] font-semibold text-error hover:bg-error-subtle"
            >
              Cancel Order
            </button>
          )}
        </div>

        {/* Why the advance button is dead — stated in the page, not just a tooltip. */}
        {blockedReason && action && (
          <div className="flex w-full gap-2 rounded-lg border border-warning-subtle bg-warning-subtle/50 px-3 py-2.5">
            <Icon name="AlertLine" size={16} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px] text-foreground">{blockedReason}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Timeline */}
          <Card title="Status timeline">
            <ol className="relative">
              {FLOW_STEPS.map((step, i) => {
                const complete = isStepComplete(step, order.status);
                const current = step === order.status;
                const entry = timelineByStatus.get(step);
                const last = i === FLOW_STEPS.length - 1;
                return (
                  <li key={step} className="flex gap-3 pb-5 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                          complete
                            ? 'border-primary bg-primary'
                            : 'border-border-strong bg-surface'
                        } ${current ? 'ring-4 ring-primary/20' : ''}`}
                      >
                        {complete && <Icon name="CheckLine" size={10} className="text-white" />}
                      </span>
                      {!last && (
                        <span
                          className={`mt-0.5 w-0.5 flex-1 ${
                            complete && !current ? 'bg-primary' : 'bg-border'
                          }`}
                        />
                      )}
                    </div>
                    <div className="-mt-0.5 pb-1">
                      <p
                        className={`text-[13px] font-semibold ${
                          complete ? 'text-foreground' : 'text-faint'
                        }`}
                      >
                        {step}
                      </p>
                      {entry && (
                        <p className="text-[12px] text-muted">{fmtDateTime(entry.timestamp)}</p>
                      )}
                      {entry?.note && <p className="mt-0.5 text-[12px] text-muted">{entry.note}</p>}
                    </div>
                  </li>
                );
              })}
              {isCancelled && (
                <li className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-error bg-error">
                      <Icon name="CloseLine" size={10} className="text-white" />
                    </span>
                  </div>
                  <div className="-mt-0.5">
                    <p className="text-[13px] font-semibold text-error">Cancelled</p>
                    {cancelledEntry && (
                      <p className="text-[12px] text-muted">{fmtDateTime(cancelledEntry.timestamp)}</p>
                    )}
                    {order.cancelReason && (
                      <p className="mt-0.5 text-[12px] text-muted">Reason: {order.cancelReason}</p>
                    )}
                  </div>
                </li>
              )}
            </ol>
          </Card>

          {/* Items */}
          <Card title={`Order items (${order.items?.length ?? 0})`}>
            <div className="divide-y divide-border">
              {order.items?.map((it, idx) => (
                <div key={`${it.variantId}-${idx}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-subtle">
                    {it.productImage ? (
                      <img src={it.productImage} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{it.productName}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                      <span
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: it.variantColor }}
                      />
                      {it.variantColor} · {it.variantName}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] text-foreground">
                      {formatINR(it.offerPrice)}
                      {it.offerPrice < it.mrp && (
                        <span className="ml-1.5 text-[12px] text-faint line-through">{formatINR(it.mrp)}</span>
                      )}
                    </p>
                    <p className="text-[12px] text-muted">×{it.quantity}</p>
                  </div>
                  <div className="w-24 text-right text-[13px] font-semibold text-foreground">
                    {formatINR(it.subtotal)}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Customer */}
          <Card title="Customer information">
            <button
              type="button"
              onClick={() => navigate(`/customers/${order.userId}`)}
              className="block w-full text-left"
            >
              <p className="text-[13px] font-semibold text-primary hover:underline">{order.userName}</p>
              <p className="mt-1 text-[13px] text-muted">{order.userPhone}</p>
              <p className="text-[13px] text-muted">{order.userEmail}</p>
            </button>
          </Card>

          {/* Shipping */}
          <Card title="Shipping address">
            <div className="space-y-0.5 text-[13px] text-muted">
              <p className="font-medium text-foreground">{order.shippingAddress?.fullName}</p>
              <p>{order.shippingAddress?.phone}</p>
              <p>{order.shippingAddress?.addressLine1}</p>
              {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
              <p>
                {order.shippingAddress?.city}, {order.shippingAddress?.state} —{' '}
                {order.shippingAddress?.pincode}
              </p>
              {order.shippingAddress?.landmark && <p>Landmark: {order.shippingAddress.landmark}</p>}
            </div>
          </Card>

          {/* Tracking */}
          {shippedOrLater && (
            <Card title="Tracking">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted">Tracking ID</span>
                  <button
                    type="button"
                    onClick={() => copy(order.trackingId)}
                    className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold text-foreground hover:text-primary"
                  >
                    {order.trackingId || '—'}
                    {order.trackingId && <Icon name="Share2Line" size={13} />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted">Courier</span>
                  <span className="text-[13px] font-medium text-foreground">{order.courierName || '—'}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Payment summary */}
          <Card title="Payment summary">
            <PaymentSummary order={order} />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmAdvance}
        title={`${action}?`}
        message={`This will move the order to "${nextStatus(order.status) ?? ''}".`}
        confirmLabel="Confirm"
        loading={updateStatusLoading}
        onConfirm={advance}
        onCancel={() => setConfirmAdvance(false)}
      />
      <ShipmentModal
        isOpen={shipOpen}
        orderId={order.id}
        onClose={() => setShipOpen(false)}
        onShipped={() => setShipOpen(false)}
      />
      <CancelOrderModal
        isOpen={cancelOpen}
        orderId={order.id}
        paymentStatus={order.paymentStatus}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => setCancelOpen(false)}
      />
    </div>
  );
};

/** Money breakdown rows for the payment summary card. */
const PaymentSummary: FC<{ order: OrderProps }> = ({ order }) => {
  const Row: FC<{ label: string; value: string; strong?: boolean; tone?: string }> = ({
    label,
    value,
    strong,
    tone,
  }) => (
    <div className="flex items-center justify-between">
      <span className={`text-[13px] ${strong ? 'font-bold text-foreground' : 'text-muted'}`}>{label}</span>
      <span className={`${strong ? 'text-[15px] font-bold' : 'text-[13px] font-medium'} ${tone ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-2">
      <Row label="Subtotal" value={formatINR(order.subtotal)} />
      {order.couponDiscount > 0 && (
        <Row
          label={`Coupon discount${order.couponCode ? ` (${order.couponCode})` : ''}`}
          value={`-${formatINR(order.couponDiscount)}`}
          tone="text-success"
        />
      )}
      {order.walletAmountUsed > 0 && (
        <Row label="Wallet used" value={`-${formatINR(order.walletAmountUsed)}`} tone="text-success" />
      )}
      <Row label="Delivery charge" value={`+${formatINR(order.deliveryCharge)}`} />
      <Row label="GST" value={`+${formatINR(order.gstAmount)}`} />
      <div className="my-2 border-t border-border" />
      <Row label="Grand total" value={formatINR(order.grandTotal)} strong />

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <PaymentMethodBadge method={order.paymentMethod} />
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>
      {order.razorpayOrderId && (
        <p className="mt-1 font-mono text-[11px] text-faint">Rzp order: {order.razorpayOrderId}</p>
      )}
      {order.razorpayPaymentId && (
        <p className="font-mono text-[11px] text-faint">Rzp payment: {order.razorpayPaymentId}</p>
      )}
    </div>
  );
};

export default OrderDetailPage;
