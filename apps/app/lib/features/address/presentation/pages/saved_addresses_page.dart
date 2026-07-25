import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../../core/constants/app_colors.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/shimmer_loading.dart';
import '../../domain/entities/address.dart';
import '../providers/address_provider.dart';

/// SavedAddressesPage (spec §2.14). In [selectMode] the whole card is tappable
/// and pops the chosen address back to checkout; otherwise it's a manage list.
class SavedAddressesPage extends StatefulWidget {
  const SavedAddressesPage({super.key, this.selectMode = false});

  final bool selectMode;

  @override
  State<SavedAddressesPage> createState() => _SavedAddressesPageState();
}

class _SavedAddressesPageState extends State<SavedAddressesPage> {
  /// Which card the radio is on in select mode. Confirmed with "Deliver here"
  /// rather than popping on tap, so a mis-tap doesn't silently change where the
  /// order goes (design "16 · Address selection", spec §2.14 "radio cards").
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final provider = context.read<AddressProvider>();
      await provider.fetchAddresses();
      if (!mounted || !widget.selectMode) return;
      setState(() => _selectedId ??= provider.defaultAddress?.id ??
          (provider.addresses.isNotEmpty ? provider.addresses.first.id : null));
    });
  }

  Future<void> _confirmDelete(Address address) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete address'),
        content: Text('Delete the address for ${address.fullName}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await context.read<AddressProvider>().deleteAddress(address.id);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AddressProvider>();

    final selected = _selectedId == null
        ? null
        : provider.addresses.where((a) => a.id == _selectedId).firstOrNull;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        titleSpacing: 12,
        leadingWidth: 74,
        leading: Center(
          child: GestureDetector(
            onTap: () => context.pop(),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 42,
              height: 42,
              margin: const EdgeInsets.only(left: 20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.hairline),
              ),
              child: const Icon(Icons.arrow_back_rounded,
                  size: 20, color: AppColors.textPrimary),
            ),
          ),
        ),
        title: Text(
          widget.selectMode ? 'Delivery address' : 'Saved addresses',
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.textPrimary,
          ),
        ),
        backgroundColor: AppColors.background,
        elevation: 0,
      ),
      bottomNavigationBar: !widget.selectMode || provider.addresses.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(top: BorderSide(color: AppColors.hairline)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: selected == null
                        ? null
                        : () => context.pop(selected),
                    child: const Text('Deliver here'),
                  ),
                ),
              ),
            ),
      // The add action sits BELOW the cards in the design, so it reads as the
      // last option in the list rather than a header action.
      body: _buildList(provider),
    );
  }

  Future<void> _openAddAddress() async {
    await context.push('/add-address');
    if (!mounted) return;
    await context.read<AddressProvider>().fetchAddresses();
  }

  Widget _buildList(AddressProvider provider) {
    if (provider.isLoading) {
      return ShimmerLoading(
        child: ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: 3,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (_, __) => const ShimmerCard(height: 120),
        ),
      );
    }

    if (provider.error != null && provider.addresses.isEmpty) {
      return ErrorState(
        message: provider.error!,
        onRetry: () => context.read<AddressProvider>().fetchAddresses(),
      );
    }

    if (provider.addresses.isEmpty) {
      return EmptyState(
        icon: Icons.location_on_outlined,
        title: 'No saved addresses',
        subtitle: 'Add your first address to get your order delivered.',
        actionLabel: 'Add new address',
        onAction: _openAddAddress,
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      itemCount: provider.addresses.length + 1,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (itemContext, i) {
        // Last row is the dashed "Add new address" card from the design.
        if (i == provider.addresses.length) {
          return _AddAddressCard(onTap: _openAddAddress);
        }
        final address = provider.addresses[i];
        return _AddressCard(
          address: address,
          selectable: widget.selectMode,
          isSelected: _selectedId == address.id,
          onSelect: () => setState(() => _selectedId = address.id),
          onEdit: () async {
            await itemContext.push('/add-address?addressId=${address.id}');
            if (!itemContext.mounted) return;
            await itemContext.read<AddressProvider>().fetchAddresses();
          },
          onDelete: () => _confirmDelete(address),
          onSetDefault: () =>
              context.read<AddressProvider>().setDefault(address.id),
        );
      },
    );
  }
}

/// The dashed "Add new address" row that closes the list (design 46:6673).
///
/// Flutter has no dashed border, so the dashes are painted directly — a solid
/// border here would read as another selectable address card.
class _AddAddressCard extends StatelessWidget {
  const _AddAddressCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: CustomPaint(
        painter: _DashedBorderPainter(),
        child: Container(
          height: 56,
          alignment: Alignment.center,
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.add_rounded, size: 20, color: AppColors.brandGreen),
              SizedBox(width: 10),
              Text(
                'Add new address',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brandGreen,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.hairline
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(12),
    );
    const dash = 6.0;
    const gap = 5.0;
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final next = (distance + dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, next), paint);
        distance = next + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.selectable,
    required this.isSelected,
    required this.onSelect,
    required this.onEdit,
    required this.onDelete,
    required this.onSetDefault,
  });

  final Address address;
  final bool selectable;
  final bool isSelected;
  final VoidCallback onSelect;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onSetDefault;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: selectable ? onSelect : null,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: (selectable ? isSelected : address.isDefault)
                ? AppColors.brandGreen
                : AppColors.hairline,
            width: selectable && isSelected ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Filled tick when chosen, hollow ring otherwise (design).
                if (selectable) ...[
                  Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? AppColors.brandGreen
                          : Colors.transparent,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isSelected
                            ? AppColors.brandGreen
                            : AppColors.hairline,
                        width: 1.5,
                      ),
                    ),
                    child: isSelected
                        ? const Icon(Icons.check_rounded,
                            size: 15, color: Colors.white)
                        : null,
                  ),
                  const SizedBox(width: 12),
                ],
                // Spec §2.14 titles the card by its label; the recipient name
                // sits beside it so a gift address is still identifiable.
                Expanded(
                  child: Row(
                    children: [
                      Text(
                        address.label,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          address.fullName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.textSecondary),
                        ),
                      ),
                    ],
                  ),
                ),
                if (address.isDefault)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.brandGreenSubtle,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Default',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppColors.brandGreen,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            // Design runs the address and phone together as one grey block.
            Padding(
              padding: EdgeInsets.only(left: selectable ? 38 : 0),
              child: Text(
                '${address.formatted} · ${address.phone}',
                style: const TextStyle(
                    fontSize: 13, height: 1.45, color: AppColors.textSecondary),
              ),
            ),
            if (!selectable) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  TextButton(onPressed: onEdit, child: const Text('Edit')),
                  TextButton(onPressed: onDelete, child: const Text('Delete')),
                  if (!address.isDefault)
                    TextButton(
                      onPressed: onSetDefault,
                      child: const Text('Set default'),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
