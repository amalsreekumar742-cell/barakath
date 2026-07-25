'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, PackageX, Printer } from 'lucide-react';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonText } from '@/components/Skeleton';
import { useAppSelector } from '@/stores/store';
import { toastError } from '@/lib/toast';
import { useOrder } from '@/features/orders/hooks/useOrder';
import { fetchInvoiceBusiness, generateInvoiceCall, type InvoiceBusiness } from '@/features/orders/api/orders';
import { SummaryRow } from '@/features/orders/components/SummaryRow';
import { formatDate, money, orderReference, paymentMethodLabel } from '@/features/orders/utils/orderFormat';
import { OrderStatus } from '@barakath/shared';

const EMPTY_BUSINESS: InvoiceBusiness = { name: 'Barakath', address: '', gstin: '', trn: '', gstPercentage: 0 };

/**
 * /account/orders/[orderId]/invoice — Invoice (spec 3.11 §5, Part 7 Tax Invoice Template).
 *
 * Available ONLY once Delivered; anything else redirects to Order Detail (guard below).
 *
 * The document is rendered NATIVELY here from the stored order + `general/config` — instant, no PDF
 * round trip needed just to look at it. "Download PDF" is the separate, web-specific action that calls
 * `generateInvoicePDF` for the archivable file; "Print" targets the SAME on-screen render via a
 * dedicated print stylesheet (`.print-area` in globals.css) rather than printing the generated PDF, so
 * there is no extra network round trip just to print.
 */
export default function InvoicePage() {
  const router = useRouter();
  const { orderId } = useParams<{ orderId: string }>();
  const uid = useAppSelector((s) => s.auth.uid);
  const authLoading = useAppSelector((s) => s.auth.authLoading);
  const { order, loading, error, notFound } = useOrder(orderId, uid);

  const [business, setBusiness] = useState<InvoiceBusiness>(EMPTY_BUSINESS);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (notFound) {
      toastError(null, 'That order could not be found.');
      router.replace('/account/orders');
    }
  }, [notFound, router]);

  useEffect(() => {
    if (order && order.status !== OrderStatus.DELIVERED) {
      router.replace(`/account/orders/${order.id}`);
    }
  }, [order, router]);

  useEffect(() => {
    fetchInvoiceBusiness()
      .then(setBusiness)
      .catch(() => {
        // Silent — the invoice still renders with the safe default, which carries the store name.
      });
  }, []);

  async function handleDownload() {
    if (!order) return;
    setDownloading(true);
    try {
      const url = await generateInvoiceCall(order.id);
      // Fetch-then-blob rather than a plain <a href> or window.open: the URL is a cross-origin Firebase
      // Storage host, and browsers widely ignore the `download` attribute (and its filename) on a
      // cross-origin link — this guarantees an actual file download with our own filename instead of
      // just opening a new tab.
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `invoice-${orderReference(order.id).replace('#', '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toastError(e, 'Could not generate the invoice. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  const isLoading = authLoading || loading || (!order && !notFound && !error);

  if (error) {
    return <EmptyState icon={<PackageX size={40} />} title="Could not load this invoice" subtitle={error} />;
  }

  if (isLoading || !order || order.status !== OrderStatus.DELIVERED) {
    return (
      <div className="space-y-4" aria-busy="true">
        <SkeletonText width="w-1/3" />
        <div className="h-28 animate-pulse rounded-xl bg-subtle" />
        <div className="h-64 animate-pulse rounded-xl bg-subtle" />
      </div>
    );
  }

  const invoiceNo = `INV-${order.id.slice(0, 8).toUpperCase()}`;
  const method = paymentMethodLabel(order);
  const taxable = order.grandTotal - (order.gstAmount || 0);
  // Split into CGST + SGST halves — mirrors the deployed `generateInvoicePDF` Cloud Function's own
  // derivation exactly (`functions/src/utility/generateInvoicePDF.ts`'s `totalLine('CGST (...)', ...)`
  // / `totalLine('SGST (...)', ...)`), an intra-state assumption since the order document carries no
  // place-of-supply field. Kept identical here so the on-screen render and the downloaded PDF never
  // quote different numbers for the same order.
  const halfRate = business.gstPercentage > 0 ? business.gstPercentage / 2 : 0;
  const cgstLabel = halfRate > 0 ? `CGST (${halfRate}%)` : 'CGST';
  const sgstLabel = halfRate > 0 ? `SGST (${halfRate}%)` : 'SGST';
  const cgst = (order.gstAmount || 0) / 2;
  const sgst = (order.gstAmount || 0) / 2;
  const address = order.shippingAddress;

  return (
    <div>
      <div className="print-hide">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'My Orders', href: '/account/orders' },
            { label: orderReference(order.id), href: `/account/orders/${order.id}` },
            { label: 'Invoice' },
          ]}
        />

        <div className="mb-4 flex justify-end gap-3">
          <Button variant="secondary" iconLeft={<Printer size={16} />} onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="primary" iconLeft={<Download size={16} />} loading={downloading} onClick={handleDownload}>
            Download PDF
          </Button>
        </div>
      </div>

      <div className="print-area space-y-4">
        {/* Header */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-2xl font-extrabold text-foreground">{business.name}</p>
              <p className="mt-0.5 text-xs font-bold tracking-wide text-muted uppercase">Tax Invoice</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-foreground">{invoiceNo}</p>
              <p className="mt-0.5 text-xs text-muted">{formatDate(order.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Seller / buyer */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-extrabold tracking-wide text-faint uppercase">Seller</p>
            <p className="mt-1.5 text-sm font-bold text-foreground">{business.name}</p>
            {business.address && <p className="text-xs text-muted">{business.address}</p>}
            {business.gstin && <p className="text-xs text-muted">GSTIN: {business.gstin}</p>}
            {business.trn && <p className="text-xs text-muted">TRN: {business.trn}</p>}
          </div>
          <div>
            <p className="text-[11px] font-extrabold tracking-wide text-faint uppercase">Billed to</p>
            <p className="mt-1.5 text-sm font-bold text-foreground">{address.fullName || order.userName}</p>
            <p className="text-xs text-muted">
              {[address.addressLine1, address.addressLine2, address.landmark, address.city, address.state, address.pincode]
                .filter((p) => p && p.trim())
                .join(', ')}
            </p>
            <p className="text-xs text-muted">{address.phone || order.userPhone}</p>
          </div>
        </div>

        {/* Order info */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-base font-extrabold text-foreground">Order</h2>
          <div className="mt-2">
            <SummaryRow label="Order ID" value={orderReference(order.id)} />
            <SummaryRow label="Date" value={formatDate(order.createdAt)} />
            {method && <SummaryRow label="Payment method" value={method} />}
            {order.razorpayPaymentId && <SummaryRow label="Transaction ID" value={order.razorpayPaymentId} />}
          </div>
        </div>

        {/* Items table — page-break-inside avoided (globals.css `.avoid-break`) */}
        <div className="avoid-break rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-base font-extrabold text-foreground">Items</h2>
          <div className="mt-2 divide-y divide-border">
            {order.items.map((item, i) => (
              <div key={`${item.productId}-${item.variantId}-${i}`} className="flex items-start gap-3 py-2.5 text-sm">
                <span className="w-5 shrink-0 text-muted">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted">
                    {[item.variantName, item.variantColor].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-muted">
                    {item.quantity} × {money(item.offerPrice)}
                  </p>
                </div>
                <span className="font-extrabold text-foreground">{money(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-base font-extrabold text-foreground">Summary</h2>
          <div className="mt-2">
            <SummaryRow label="Subtotal" value={money(order.subtotal)} />
            {order.couponDiscount > 0 && (
              <SummaryRow
                label={order.couponCode ? `Coupon (${order.couponCode})` : 'Coupon discount'}
                value={`− ${money(order.couponDiscount)}`}
                emphasis="discount"
              />
            )}
            {order.walletAmountUsed > 0 && (
              <SummaryRow label="Wallet used" value={`− ${money(order.walletAmountUsed)}`} emphasis="discount" />
            )}
            <SummaryRow label="Delivery" value={order.deliveryCharge <= 0 ? 'Free' : money(order.deliveryCharge)} />
            <SummaryRow label="Taxable value" value={money(taxable)} />
            {order.gstAmount > 0 && (
              <>
                <SummaryRow label={cgstLabel} value={money(cgst)} />
                <SummaryRow label={sgstLabel} value={money(sgst)} />
              </>
            )}
            <div className="pt-2">
              <SummaryRow label="Grand Total" value={money(order.grandTotal)} emphasis="total" />
            </div>
          </div>
        </div>

        <p className="pb-6 text-center text-[11px] leading-relaxed text-faint">
          Computer-generated invoice · {business.name}
          {business.address ? ` · ${business.address}` : ''}
        </p>
      </div>
    </div>
  );
}
