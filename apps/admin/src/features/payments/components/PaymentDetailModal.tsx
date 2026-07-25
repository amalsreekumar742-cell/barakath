import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { PaymentMethod, PaymentStatus } from '@barakath/shared/config/enums';
import { useAppDispatch, useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import OrderStatusBadge from '@/components/OrderStatusBadge';
import { formatINR } from '@/utils/format';
import { fetchPaymentDetail } from '../api/fetchPaymentDetail';
import { resetPaymentDetail } from '../stores/paymentsSlice';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentBadges';
import TaxInvoiceModal from './TaxInvoiceModal';

/** A section wrapper with a heading. */
const Section: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-t border-border pt-4">
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-faint">{title}</p>
    {children}
  </div>
);

/** A label/value row; the value is optionally a copyable monospace id. */
const InfoRow: FC<{ label: string; value: string; mono?: boolean; onCopy?: () => void }> = ({
  label,
  value,
  mono,
  onCopy,
}) => (
  <div className="flex items-center justify-between gap-3 py-0.5">
    <span className="text-[13px] text-muted">{label}</span>
    {onCopy ? (
      <button
        type="button"
        onClick={onCopy}
        className={`inline-flex items-center gap-1.5 text-right ${mono ? 'font-mono text-[12px]' : 'text-[13px]'} font-medium text-foreground hover:text-primary`}
      >
        {value}
        <Icon name="Share2Line" size={12} />
      </button>
    ) : (
      <span className={`text-right ${mono ? 'font-mono text-[12px]' : 'text-[13px]'} font-medium text-foreground`}>
        {value}
      </span>
    )}
  </div>
);

/**
 * PaymentDetailModal — the full payment record with gateway / wallet / refund / GST sections and the
 * associated order (spec §1.9). Fetches on open, shows a skeleton while loading, and opens the printable
 * tax invoice when the payment is Paid or Refunded. Built on the shared Modal.
 */
const PaymentDetailModal: FC<{ isOpen: boolean; paymentId: string | null; onClose: () => void }> = ({
  isOpen,
  paymentId,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { paymentDetail, detailLoading, detailError } = useAppSelector((s) => s.payments);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  useEffect(() => {
    if (isOpen && paymentId) void dispatch(fetchPaymentDetail(paymentId));
    if (!isOpen) dispatch(resetPaymentDetail());
  }, [isOpen, paymentId, dispatch]);

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => toast.success('Copied'),
      () => toast.error('Could not copy'),
    );
  };

  const payment = paymentDetail?.payment;
  const order = paymentDetail?.order ?? null;
  const hasRazorpay = payment?.method === PaymentMethod.RAZORPAY || payment?.method === PaymentMethod.BOTH;
  const hasWallet = payment?.method === PaymentMethod.WALLET || payment?.method === PaymentMethod.BOTH;
  const canInvoice = payment?.status === PaymentStatus.PAID || payment?.status === PaymentStatus.REFUNDED;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
        <div className="max-h-[88vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-[16px] font-bold tracking-tight text-foreground">Payment Details</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground"
              aria-label="Close"
            >
              <Icon name="CloseLine" size={18} />
            </button>
          </div>

          <div className="px-6 py-5">
            {detailLoading || !payment ? (
              detailError ? (
                <p className="py-6 text-center text-[14px] text-muted">{detailError}</p>
              ) : (
                <div className="space-y-3">
                  <Skeleton height={80} borderRadius={12} />
                  <Skeleton height={120} borderRadius={12} />
                  <Skeleton height={90} borderRadius={12} />
                </div>
              )
            ) : (
              <div className="space-y-4">
                {/* Payment information */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[12px] text-muted">{payment.id}</p>
                      <p className="mt-1 text-[26px] font-extrabold tracking-tight text-foreground">
                        {formatINR(payment.amount)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <PaymentMethodBadge method={payment.method} />
                        <span className="text-[12px] text-muted">
                          {payment.createdAt ? format(payment.createdAt.toDate(), 'dd MMM yyyy, hh:mm a') : '—'}
                        </span>
                      </div>
                    </div>
                    <PaymentStatusBadge status={payment.status} large />
                  </div>
                </div>

                {/* Razorpay */}
                {hasRazorpay && (
                  <Section title="Razorpay details">
                    <InfoRow
                      label="Razorpay Order ID"
                      value={payment.razorpayOrderId || '—'}
                      mono
                      onCopy={payment.razorpayOrderId ? () => copy(payment.razorpayOrderId) : undefined}
                    />
                    <InfoRow
                      label="Razorpay Payment ID"
                      value={payment.razorpayPaymentId || '—'}
                      mono
                      onCopy={payment.razorpayPaymentId ? () => copy(payment.razorpayPaymentId) : undefined}
                    />
                    <InfoRow label="Amount paid via Razorpay" value={formatINR(payment.razorpayAmountPaid ?? 0)} />
                  </Section>
                )}

                {/* Wallet */}
                {hasWallet && (
                  <Section title="Wallet details">
                    <InfoRow label="Wallet amount used" value={formatINR(payment.walletAmountUsed ?? 0)} />
                  </Section>
                )}

                {/* Refund */}
                {payment.status === PaymentStatus.REFUNDED && (
                  <Section title="Refund details">
                    <InfoRow label="Refund ID" value={payment.refundId || '—'} mono />
                    <InfoRow label="Refund amount" value={formatINR(payment.refundAmount ?? 0)} />
                    <InfoRow
                      label="Refunded at"
                      value={payment.refundedAt ? format(payment.refundedAt.toDate(), 'dd MMM yyyy, hh:mm a') : '—'}
                    />
                  </Section>
                )}

                {/* GST */}
                <Section title="Tax">
                  <InfoRow label="GST amount" value={formatINR(payment.gstAmount ?? 0)} />
                </Section>

                {/* Associated order */}
                <Section title="Associated order">
                  {order ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            navigate(`/orders/${order.id}`);
                          }}
                          className="font-mono text-[13px] font-semibold text-primary hover:underline"
                        >
                          #{order.id.slice(0, 12)}…
                        </button>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <InfoRow label="Items" value={String(order.items?.length ?? 0)} />
                      <InfoRow label="Grand total" value={formatINR(order.grandTotal)} />
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted">Order #{payment.orderId} is unavailable.</p>
                  )}
                </Section>

                {/* Tax invoice */}
                {canInvoice && (
                  <Section title="Tax invoice">
                    <button
                      type="button"
                      onClick={() => setInvoiceOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
                    >
                      <Icon name="EyeLine" size={16} /> View Tax Invoice
                    </button>
                  </Section>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {payment && (
        <TaxInvoiceModal
          isOpen={invoiceOpen}
          onClose={() => setInvoiceOpen(false)}
          payment={payment}
          order={order}
        />
      )}
    </>
  );
};

export default PaymentDetailModal;
