import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimens.dart';
import '../../../../core/widgets/app_toast.dart';
import '../../../../core/widgets/circle_back_button.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/key_value_row.dart';
import '../../../../core/widgets/section_card.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../domain/entities/gst_breakdown.dart';
import '../../domain/entities/invoice_business.dart';
import '../../domain/entities/order.dart';
import '../providers/order_detail_provider.dart';
import '../widgets/order_format.dart';

/// Invoice (spec §2.19, Part 7 Tax Invoice Template).
///
/// The document is rendered NATIVELY from the stored order plus `general/config`
/// — the customer sees it instantly, offline of the PDF pipeline. The share icon
/// then calls `generateInvoicePDF`, which is what produces the signed, archivable
/// file, and shares its URL.
///
/// PART-7 GAP — CGST / SGST: the template asks for "Taxable value, CGST, SGST",
/// but the deployed order document stores a SINGLE `gstAmount` and no
/// `taxableValue`, and nothing records the place of supply. A 50/50 split would
/// be an invention (an inter-state order is IGST, not CGST+SGST), so this screen
/// renders ONE "GST" line. Reported to the coordinator: the split needs either a
/// `cgst`/`sgst` pair written by `createPaymentOrder` or a place-of-supply flag.
class InvoicePage extends StatefulWidget {
  const InvoicePage({super.key, required this.orderId});

  final String orderId;

  @override
  State<InvoicePage> createState() => _InvoicePageState();
}

class _InvoicePageState extends State<InvoicePage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<OrderDetailProvider>();
      provider.load(widget.orderId, force: false);
      provider.loadBusiness();
    });
  }

  Future<void> _share() async {
    final provider = context.read<OrderDetailProvider>();
    final order = provider.order;
    if (order == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Share this invoice?'),
        content: const Text(
          'We will generate the PDF and open your share sheet.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Share'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final error = await provider.generateInvoice();
    if (!mounted) return;
    if (error != null) {
      AppToast.error(context, error);
      return;
    }

    final url = provider.invoiceUrl;
    if (url == null || url.isEmpty) {
      AppToast.error(context, 'The invoice is not ready yet');
      return;
    }

    await Share.share(
      'Tax invoice for order ${OrderFormat.reference(order)}\n$url',
      subject: 'Barakath tax invoice',
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<OrderDetailProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: CircleBackButton.leadingWidth,
        leading: CircleBackButton.appBarLeading(
          fallbackRoute: '/orders/${widget.orderId}',
        ),
        title: const Text(
          'Invoice',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: AppDimens.space12),
            child: provider.isGeneratingInvoice
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    onPressed: provider.order == null ? null : _share,
                    icon: const Icon(Icons.ios_share_rounded, size: 20),
                    color: AppColors.textPrimary,
                    tooltip: 'Share invoice',
                  ),
          ),
        ],
      ),
      body: _body(provider),
    );
  }

  Widget _body(OrderDetailProvider provider) {
    if (provider.state == OrderDetailState.error) {
      return ErrorState(
        message: provider.error ?? 'Could not load this invoice.',
        onRetry: () =>
            context.read<OrderDetailProvider>().load(widget.orderId),
      );
    }
    if (provider.isLoading ||
        provider.state == OrderDetailState.initial ||
        provider.order?.id != widget.orderId) {
      return const _InvoiceSkeleton();
    }

    final order = provider.order!;
    final business = provider.business;

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: [
        _header(order, business),
        const SizedBox(height: AppDimens.gapCards),
        _parties(order, business),
        const SizedBox(height: AppDimens.gapCards),
        _orderInfo(order),
        const SizedBox(height: AppDimens.gapCards),
        _itemsTable(order),
        const SizedBox(height: AppDimens.gapCards),
        _summary(order, business),
        const SizedBox(height: AppDimens.gapSections),
        _footer(business),
      ],
    );
  }

  /// Part 7 "Header": business name on the left, TAX INVOICE / number / date on
  /// the right. The invoice number mirrors the Cloud Function's `INV-{first 8}`
  /// so the in-app document and the shared PDF quote the same reference.
  Widget _header(Order order, InvoiceBusiness business) {
    final invoiceNo =
        'INV-${order.id.substring(0, order.id.length < 8 ? order.id.length : 8).toUpperCase()}';

    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  business.name,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Tax Invoice',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.4,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                invoiceNo,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                OrderFormat.date(order.createdAt),
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Part 7 "Business Info" + "Customer Info".
  Widget _parties(Order order, InvoiceBusiness business) {
    final address = order.shippingAddress;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _blockTitle('SELLER'),
          Text(business.name, style: _strongText),
          if (business.address.isNotEmpty)
            Text(business.address, style: _bodyText),
          if (business.gstin.isNotEmpty)
            Text('GSTIN: ${business.gstin}', style: _bodyText),
          if (business.trn.isNotEmpty) Text('TRN: ${business.trn}', style: _bodyText),
          const Divider(height: AppDimens.space20, color: AppColors.hairline),
          _blockTitle('BILLED TO'),
          Text(
            address.fullName.isEmpty ? order.userName : address.fullName,
            style: _strongText,
          ),
          Text(address.formatted, style: _bodyText),
          Text(
            address.phone.isEmpty ? order.userPhone : address.phone,
            style: _bodyText,
          ),
        ],
      ),
    );
  }

  /// Part 7 "Order Info".
  Widget _orderInfo(Order order) {
    final method = OrderFormat.paymentMethod(order);

    return SectionCard(
      title: 'Order',
      child: Column(
        children: [
          KeyValueRow(label: 'Order ID', value: OrderFormat.reference(order)),
          KeyValueRow(label: 'Date', value: OrderFormat.date(order.createdAt)),
          // COD is never rendered — it is not a payment method this store offers.
          if (method != null)
            KeyValueRow(label: 'Payment method', value: method),
          if (order.razorpayPaymentId.isNotEmpty)
            KeyValueRow(
              label: 'Transaction ID',
              value: order.razorpayPaymentId,
            ),
        ],
      ),
    );
  }

  /// Part 7 "Items Table": # | Product | Variant | Qty | Unit price | Total.
  Widget _itemsTable(Order order) {
    return SectionCard(
      title: 'Items',
      child: Column(
        children: [
          for (var i = 0; i < order.items.length; i++) ...[
            if (i > 0)
              const Divider(height: AppDimens.space16, color: AppColors.hairline),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 18,
                  child: Text('${i + 1}.', style: _bodyText),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(order.items[i].productName, style: _strongText),
                      const SizedBox(height: 2),
                      Text(
                        [
                          if (order.items[i].variantName.isNotEmpty)
                            order.items[i].variantName,
                          if (order.items[i].variantColor.isNotEmpty)
                            order.items[i].variantColor,
                        ].join(' · '),
                        style: _bodyText,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${order.items[i].quantity} × ${OrderFormat.money(order.items[i].offerPrice)}',
                        style: _bodyText,
                      ),
                    ],
                  ),
                ),
                Text(
                  OrderFormat.money(order.items[i].subtotal),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  /// Part 7 "Price Summary".
  Widget _summary(Order order, InvoiceBusiness business) {
    // The order stores no `taxableValue`, so it is derived — and HOW depends on
    // which GST model the order was placed under (see Order.gstInclusive):
    //   inclusive (2026-08-04 on): the price contains the tax → subtotal − gst
    //     (₹800 − ₹72 = ₹728), and the total is unaffected by the tax.
    //   exclusive (before):        the tax was added on top → grandTotal − gst.
    // Deriving both the same way would restate paid invoices for old orders.
    final taxable = order.gstInclusive
        ? order.taxableValue
        : order.grandTotal - order.gstAmount;
    const gstLabel = 'GST';
    // Rate-wise breakup when the order carries per-line tax; empty for orders predating it.
    final gstRows = gstBreakdown(order);
    String pct(double v) => v.toStringAsFixed(v % 1 == 0 ? 0 : 1);

    return SectionCard(
      title: 'Summary',
      child: Column(
        children: [
          KeyValueRow(
            label: 'Subtotal',
            value: OrderFormat.money(order.subtotal),
          ),
          if (order.couponDiscount > 0)
            KeyValueRow(
              label: order.couponCode.isEmpty
                  ? 'Coupon discount'
                  : 'Coupon (${order.couponCode})',
              value: '− ${OrderFormat.money(order.couponDiscount)}',
              valueColor: AppColors.semanticSuccess,
            ),
          if (order.walletAmountUsed > 0)
            KeyValueRow(
              label: 'Wallet used',
              value: '− ${OrderFormat.money(order.walletAmountUsed)}',
              valueColor: AppColors.semanticSuccess,
            ),
          KeyValueRow(
            label: 'Delivery',
            value: order.deliveryCharge <= 0
                ? 'Free'
                : OrderFormat.money(order.deliveryCharge),
          ),
          KeyValueRow(
            label: 'Taxable value',
            value: OrderFormat.money(taxable),
          ),
          // Rate-wise GST when the order has it, else the single legacy line. Still not split into
          // CGST + SGST — see the class doc for why that needs a place-of-supply flag.
          if (gstRows.isNotEmpty)
            for (final row in gstRows)
              KeyValueRow(
                label:
                    'GST ${pct(row.percentage)}% on ${OrderFormat.money(row.taxableValue)}',
                value: OrderFormat.money(row.gstAmount),
              )
          else
            KeyValueRow(
              label: gstLabel,
              value: OrderFormat.money(order.gstAmount),
            ),
          const Divider(height: AppDimens.space20, color: AppColors.hairline),
          KeyValueRow(
            label: 'Grand Total',
            value: OrderFormat.money(order.grandTotal),
            emphasis: true,
          ),
        ],
      ),
    );
  }

  /// Part 7 "Footer".
  Widget _footer(InvoiceBusiness business) {
    final location = business.address.isEmpty ? '' : ' · ${business.address}';
    return Text(
      'Computer-generated invoice · ${business.name}$location',
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 11,
        height: 1.5,
        color: AppColors.textFaint,
      ),
    );
  }

  Widget _blockTitle(String label) => Padding(
        padding: const EdgeInsets.only(bottom: AppDimens.space6),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
            color: AppColors.textFaint,
          ),
        ),
      );

  static const TextStyle _strongText = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle _bodyText = TextStyle(
    fontSize: 12,
    height: 1.5,
    color: AppColors.textSecondary,
  );
}

class _InvoiceSkeleton extends StatelessWidget {
  const _InvoiceSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppDimens.screenPadding,
        AppDimens.space12,
        AppDimens.screenPadding,
        AppDimens.space24,
      ),
      children: const [
        ShimmerCard(height: 44),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 110),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 90),
        SizedBox(height: AppDimens.gapCards),
        ShimmerCard(height: 120),
      ],
    );
  }
}
