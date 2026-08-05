import type { FC } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { OrderProps, PaymentProps } from '@barakath/shared/types';
import { gstBreakdown, gstPresentation } from '@barakath/shared/utils/gstBreakdown';
import { useAppSelector } from '@/stores/store';
import Modal from '@/components/Modal';
import Icon from '@/components/icons/Icon';
import { formatINR } from '@/utils/format';

/**
 * TaxInvoiceModal — a printable tax invoice for an order/payment (spec §1.9 Tax Invoice dialog). Built on
 * the shared Modal. "Print" uses `window.print()`; the injected `@media print` block hides everything
 * except the invoice body (the modal chrome/backdrop/buttons carry `no-print`). Seller GSTIN/address come
 * from the Settings store when loaded, with sensible placeholders otherwise (a client can't be trusted
 * with money math — the figures are the server-computed order totals, shown read-only).
 */
const TaxInvoiceModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentProps;
  order: OrderProps | null;
}> = ({ isOpen, onClose, payment, order }) => {
  // Read seller details from the Settings slice if it happens to be loaded; else fall back to placeholders.
  const settings = useAppSelector((s) => s.settings.settings);
  const gstin = settings?.delivery.gstin || '32ABCDE1234F1Z5';

  const gstRows = order ? gstBreakdown(order) : [];
  // Whether this order's tax sits inside its prices, and the taxable value to print. Shared with the
  // app's invoice so the two documents can never state a different split for the same order.
  const tax = order
    ? gstPresentation(order)
    : { taxableValue: 0, gstAmount: 0, inclusive: false };

  const invoiceNo = order ? `INV-${order.id.slice(0, 8).toUpperCase()}` : 'INV-—';
  const invoiceDate = order?.createdAt ? format(order.createdAt.toDate(), 'dd MMM yyyy') : '—';

  const Row: FC<{ label: string; value: string; strong?: boolean; tone?: string }> = ({
    label,
    value,
    strong,
    tone,
  }) => (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-[13px] ${strong ? 'font-bold text-foreground' : 'text-muted'}`}>{label}</span>
      <span className={`${strong ? 'text-[15px] font-bold' : 'text-[13px] font-medium'} ${tone ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #tax-invoice, #tax-invoice * { visibility: visible !important; }
          #tax-invoice {
            position: fixed; inset: 0; margin: 0; width: 100%;
            max-height: none; overflow: visible; border: 0; border-radius: 0; box-shadow: none;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        id="tax-invoice"
        className="max-h-[88vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-lg"
      >
        {/* Chrome header (hidden in print) */}
        <div className="no-print flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-[16px] font-bold tracking-tight text-foreground">Tax Invoice</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-subtle hover:text-foreground"
            aria-label="Close"
          >
            <Icon name="CloseLine" size={18} />
          </button>
        </div>

        {/* Invoice body */}
        <div className="px-8 py-6">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border pb-5">
            <div>
              <p className="text-[22px] font-extrabold tracking-tight text-foreground">Barakath</p>
              <p className="mt-0.5 text-[12px] text-muted">Islamic lifestyle store</p>
            </div>
            <div className="text-right">
              <p className="text-[16px] font-bold uppercase tracking-wide text-foreground">Tax Invoice</p>
              <p className="mt-1 font-mono text-[12px] text-muted">{invoiceNo}</p>
              <p className="text-[12px] text-muted">{invoiceDate}</p>
            </div>
          </div>

          {/* Seller / Buyer */}
          <div className="grid grid-cols-2 gap-6 border-b border-border py-5">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">Seller</p>
              <p className="text-[13px] font-semibold text-foreground">Barakath</p>
              <p className="text-[12px] text-muted">Kerala, India</p>
              <p className="mt-1 font-mono text-[12px] text-muted">GSTIN: {gstin}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">Billed to</p>
              <p className="text-[13px] font-semibold text-foreground">
                {order?.shippingAddress?.fullName || order?.userName || payment.userName || '—'}
              </p>
              {order?.shippingAddress && (
                <div className="text-[12px] text-muted">
                  <p>{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state} —{' '}
                    {order.shippingAddress.pincode}
                  </p>
                </div>
              )}
              <p className="mt-1 text-[12px] text-muted">
                {order?.shippingAddress?.phone || order?.userPhone || payment.userPhone || '—'}
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto py-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['#', 'Product', 'Variant', 'Qty', 'MRP', 'Offer Price', 'Subtotal'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2 text-[11px] font-semibold uppercase tracking-wide text-faint ${
                        i >= 3 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(order?.items ?? []).map((it, idx) => (
                  <tr key={`${it.variantId}-${idx}`} className="border-b border-border last:border-0">
                    <td className="py-2 text-[12px] text-muted">{idx + 1}</td>
                    <td className="py-2 text-[13px] font-medium text-foreground">{it.productName}</td>
                    <td className="py-2 text-[12px] text-muted">
                      {[it.variantColor, it.variantName].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="py-2 text-right text-[13px] text-foreground">{it.quantity}</td>
                    <td className="py-2 text-right text-[13px] text-muted">{formatINR(it.mrp)}</td>
                    <td className="py-2 text-right text-[13px] text-foreground">{formatINR(it.offerPrice)}</td>
                    <td className="py-2 text-right text-[13px] font-semibold text-foreground">{formatINR(it.subtotal)}</td>
                  </tr>
                ))}
                {(!order || order.items?.length === 0) && (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-[13px] text-muted">
                      No line items available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          {order && (
            <div className="ml-auto max-w-xs border-t border-border pt-3">
              {/* On a GST-INCLUSIVE order the listed price already contains the tax, so the invoice
                  states the taxable value (subtotal − GST, e.g. ₹800 − ₹72 = ₹728) and the GST rows
                  below are a breakdown OF that price, not an addition to it. Orders placed before
                  2026-08-04 had GST added on top and keep the original presentation — an invoice must
                  not restate what a customer already paid. */}
              <Row
                label={tax.inclusive ? 'Taxable value' : 'Subtotal'}
                value={formatINR(tax.inclusive ? tax.taxableValue : order.subtotal)}
              />
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
              {/* Rate-wise GST, one row per rate present on the order. Orders placed before per-line
                  GST existed carry only the order-level total, so `gstBreakdown` returns [] for them
                  and the single line below is shown instead — never a fabricated split. */}
              {gstRows.length > 0 ? (
                gstRows.map((r) => (
                  <Row
                    key={r.percentage}
                    label={`GST ${r.percentage}% on ${formatINR(r.taxableValue)}`}
                    value={`${tax.inclusive ? '' : '+'}${formatINR(r.gstAmount)}`}
                  />
                ))
              ) : (
                <Row label="GST" value={`${tax.inclusive ? '' : '+'}${formatINR(order.gstAmount)}`} />
              )}
              {tax.inclusive && (
                <p className="mt-1 text-[11px] text-muted">Prices are inclusive of GST.</p>
              )}
              <div className="my-2 border-t border-border" />
              <Row label="Grand Total" value={formatINR(order.grandTotal)} strong />
            </div>
          )}

          {/* Payment information */}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">Payment information</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
              <span className="text-muted">Method</span>
              <span className="text-right font-medium text-foreground">{payment.method}</span>
              {payment.razorpayPaymentId && (
                <>
                  <span className="text-muted">Razorpay Payment ID</span>
                  <span className="text-right font-mono text-[12px] text-foreground">{payment.razorpayPaymentId}</span>
                </>
              )}
              <span className="text-muted">Payment status</span>
              <span className="text-right font-medium text-foreground">{payment.status}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 border-t border-border pt-4 text-center">
            <p className="text-[13px] font-semibold text-foreground">Thank you for shopping with Barakath</p>
            <p className="mt-0.5 text-[11px] text-faint">This is a computer-generated invoice.</p>
          </div>
        </div>

        {/* Actions (hidden in print) */}
        <div className="no-print flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => toast('PDF generation coming soon')}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2 text-[14px] font-semibold text-foreground hover:bg-subtle"
          >
            <Icon name="ArrowDownLine" size={16} /> Download PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-dark"
          >
            <Icon name="ToolsLine" size={16} /> Print
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TaxInvoiceModal;
