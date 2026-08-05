import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { Collections } from '../config/collections';
import { getGeneralConfig } from '../config/razorpay';
import { validateAuth } from '../utils/validateAuth';
import { gstBreakdown } from './service/gstBreakdown';

/** Minimal shapes read off the order doc (kept local — functions do not import packages/shared). */
interface InvoiceItem {
  productName: string;
  variantName: string;
  variantColor: string;
  mrp: number;
  offerPrice: number;
  quantity: number;
  subtotal: number;
}
interface InvoiceAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  landmark: string;
}

const rupee = (n: number): string => `Rs. ${(Number(n) || 0).toFixed(2)}`;

/** Render the order into a PDF and resolve the finished buffer. */
function buildPdf(
  order: FirebaseFirestore.DocumentData,
  config: FirebaseFirestore.DocumentData,
  orderId: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const shortId = orderId.slice(0, 8).toUpperCase();
    const items = (order.items as InvoiceItem[] | undefined) ?? [];
    const ship = (order.shippingAddress as InvoiceAddress | undefined) ?? ({} as InvoiceAddress);
    const gstRate = Number(config.gstRate) || 0;
    const gstAmount = Number(order.gstAmount) || 0;
    const grandTotal = Number(order.grandTotal) || 0;
    const subtotal = Number(order.subtotal) || 0;
    // Which GST model this order was placed under decides how the taxable value is derived.
    //   inclusive (2026-08-04 on): tax sits INSIDE the price → subtotal − gst (₹800 − ₹72 = ₹728),
    //                              and it does not move the grand total.
    //   exclusive (before):        tax was added on top      → grandTotal − gst.
    // The flag is absent on every older document, which is exactly the exclusive case — so a paid
    // invoice reprinted today still states the figures the customer was actually charged.
    const gstInclusive = order.gstInclusive === true;
    const taxable = gstInclusive ? subtotal - gstAmount : grandTotal - gstAmount;

    // Header — business name (left) + TAX INVOICE / number (right).
    doc.fontSize(20).text(String(config.businessName ?? 'Barakath'), 50, 50);
    doc
      .fontSize(16)
      .text('TAX INVOICE', 0, 50, { align: 'right' })
      .fontSize(10)
      .text(`INV-${shortId}`, { align: 'right' })
      .text(new Date().toLocaleDateString('en-IN'), { align: 'right' });
    doc.moveDown(2);

    // Seller block.
    doc.fontSize(11).text('Seller', 50, 120, { underline: true });
    doc.fontSize(9);
    doc.text(String(config.businessName ?? ''));
    if (config.businessAddress) doc.text(String(config.businessAddress));
    if (config.gstin) doc.text(`GSTIN: ${config.gstin}`);
    if (config.businessTRN) doc.text(`TRN: ${config.businessTRN}`);

    // Buyer block.
    const buyerTop = 120;
    doc.fontSize(11).text('Billed To', 320, buyerTop, { underline: true });
    doc.fontSize(9);
    doc.text(String(ship.fullName ?? order.userName ?? ''), 320);
    const addressLine = [ship.addressLine1, ship.addressLine2, ship.landmark]
      .filter(Boolean)
      .join(', ');
    if (addressLine) doc.text(addressLine, 320, undefined, { width: 225 });
    const cityLine = [ship.city, ship.state, ship.pincode].filter(Boolean).join(', ');
    if (cityLine) doc.text(cityLine, 320, undefined, { width: 225 });
    doc.text(`Phone: ${ship.phone ?? order.userPhone ?? ''}`, 320);

    // Items table.
    let y = 220;
    const cols = { idx: 50, product: 75, variant: 240, qty: 340, mrp: 375, offer: 435, sub: 495 };
    doc.fontSize(9).text('#', cols.idx, y);
    doc.text('Product', cols.product, y);
    doc.text('Variant', cols.variant, y);
    doc.text('Qty', cols.qty, y);
    doc.text('MRP', cols.mrp, y);
    doc.text('Offer', cols.offer, y);
    doc.text('Subtotal', cols.sub, y);
    y += 14;
    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 6;

    items.forEach((it, i) => {
      if (y > 720) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(8);
      doc.text(String(i + 1), cols.idx, y);
      doc.text(String(it.productName ?? ''), cols.product, y, { width: 160 });
      doc.text(`${it.variantName ?? ''} ${it.variantColor ?? ''}`.trim(), cols.variant, y, { width: 95 });
      doc.text(String(it.quantity ?? 0), cols.qty, y);
      doc.text(rupee(it.mrp), cols.mrp, y);
      doc.text(rupee(it.offerPrice), cols.offer, y);
      doc.text(rupee(it.subtotal), cols.sub, y);
      y += 18;
    });
    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 10;

    // Totals block (right aligned).
    const totalLine = (label: string, value: string) => {
      doc.fontSize(9).text(label, 360, y).text(value, 470, y, { align: 'right', width: 75 });
      y += 15;
    };
    totalLine('Subtotal', rupee(order.subtotal));
    if (Number(order.couponDiscount) > 0) {
      totalLine(`Coupon (${order.couponCode ?? ''})`, `- ${rupee(order.couponDiscount)}`);
    }
    if (Number(order.walletAmountUsed) > 0) {
      totalLine('Wallet used', `- ${rupee(order.walletAmountUsed)}`);
    }
    totalLine('Delivery', rupee(order.deliveryCharge));
    totalLine('Taxable value', rupee(taxable));
    // Rate-wise GST, each rate split into CGST + SGST halves (intra-state default — the order carries
    // no place-of-supply field, so an inter-state single-IGST order can't be told apart).
    //
    // The halves now come from the rate ACTUALLY CHARGED on each line rather than from the shop-wide
    // rate: with per-variant GST those differ, and a mixed-rate order would otherwise be documented
    // at a rate it never paid. Orders placed before per-line GST return no rows, and fall back to the
    // single pair below rather than having a split invented for them.
    const gstRows = gstBreakdown(order);
    if (gstRows.length > 0) {
      for (const row of gstRows) {
        const half = (row.percentage / 2).toFixed(1);
        totalLine(`CGST (${half}%) on ${rupee(row.taxableValue)}`, rupee(row.gstAmount / 2));
        totalLine(`SGST (${half}%) on ${rupee(row.taxableValue)}`, rupee(row.gstAmount / 2));
      }
    } else {
      totalLine(`CGST (${(gstRate / 2).toFixed(1)}%)`, rupee(gstAmount / 2));
      totalLine(`SGST (${(gstRate / 2).toFixed(1)}%)`, rupee(gstAmount / 2));
    }
    doc.moveTo(360, y).lineTo(545, y).stroke();
    y += 6;
    doc.fontSize(11).text('Grand Total', 360, y).text(rupee(grandTotal), 470, y, {
      align: 'right',
      width: 75,
    });
    y += 24;

    // Payment block.
    doc.fontSize(9);
    doc.text(`Payment method: ${order.paymentMethod ?? ''}`, 50, y);
    y += 13;
    if (order.razorpayPaymentId) {
      doc.text(`Razorpay payment id: ${order.razorpayPaymentId}`, 50, y);
      y += 13;
    }
    doc.text(`Payment status: ${order.paymentStatus ?? ''}`, 50, y);

    // Footer.
    doc
      .fontSize(8)
      .text(
        `Computer-generated invoice — ${config.businessName ?? 'Barakath'}. No signature required.`,
        50,
        780,
        { align: 'center', width: 495 },
      );

    doc.end();
  });
}

/**
 * generateInvoicePDF — build the tax-invoice PDF for a DELIVERED order, store it, and return a download URL.
 *
 * WHY a Cloud Function: it reads general/config (admin-read-only company details + GSTIN) and writes to
 *   Storage under a privileged path — neither is available to the client. pdfkit renders server-side.
 * WHY onCall: called by our own admin panel and the customer app (both via httpsCallable).
 * AUTH: validateAuth (signed-in), then an ownership/admin check — the caller must be an admin OR the
 *   order's own owner. A customer can only ever fetch their own invoice.
 * PRECONDITION: the order must be Delivered (spec: the Invoice button only appears once delivered).
 *
 * Request:  { orderId }
 * Response: { invoiceUrl }
 */
export const generateInvoicePDF = onCall(async (request) => {
  const uid = validateAuth(request);
  const orderId = (request.data as { orderId?: string })?.orderId?.trim();
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required');

  const db = getFirestore();

  try {
    const orderSnap = await db.collection(Collections.orders).doc(orderId).get();
    if (!orderSnap.exists) throw new HttpsError('not-found', 'Order not found.');
    const order = orderSnap.data() as FirebaseFirestore.DocumentData;

    // Ownership / admin gate — a customer may only fetch their own invoice.
    const isAdmin = request.auth?.token.admin === true;
    if (!isAdmin && order.userId !== uid) {
      throw new HttpsError('permission-denied', 'You can only download your own invoice.');
    }

    if (order.status !== 'Delivered') {
      throw new HttpsError('failed-precondition', 'An invoice is available only after delivery.');
    }

    const config = await getGeneralConfig();
    const pdf = await buildPdf(order, config, orderId);

    // Upload with a Firebase download token so a token-scoped URL works without signBlob IAM.
    const token = uuidv4();
    const path = `invoices/${orderId}/invoice.pdf`;
    const bucket = getStorage().bucket();
    const file = bucket.file(path);
    await file.save(pdf, {
      metadata: {
        contentType: 'application/pdf',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const invoiceUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
      path,
    )}?alt=media&token=${token}`;

    await orderSnap.ref.update({ invoiceUrl, updatedAt: FieldValue.serverTimestamp() });
    return { invoiceUrl };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('generateInvoicePDF failed', err);
    throw new HttpsError('internal', 'Could not generate the invoice.');
  }
});
