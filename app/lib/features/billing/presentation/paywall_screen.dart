import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/billing/data/billing_repository.dart';
import 'package:pepper/features/billing/domain/billing_product.dart';

final productsProvider =
    FutureProvider((ref) => ref.watch(billingRepositoryProvider).products());

class PaywallScreen extends ConsumerStatefulWidget {
  const PaywallScreen({super.key});
  @override
  ConsumerState<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends ConsumerState<PaywallScreen> {
  var _currency = 'LRD';
  BillingProduct? _selected;
  bool _buying = false;

  Future<void> _buy() async {
    final product = _selected;
    if (product == null || _buying) return;
    setState(() => _buying = true);
    try {
      if (kDebugMode) {
        await ref.read(billingRepositoryProvider).verifyFake(product);
      } else {
        await ref.read(billingRepositoryProvider).purchaseStore(product);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Upgrade activated. Enjoy your new features.'),
          ),
        );
        Navigator.pop(context, true);
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Purchase could not be completed.')),
        );
      }
    } finally {
      if (mounted) setState(() => _buying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(productsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Upgrade Pepper')),
      body: products.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) =>
            PepperErrorView(onRetry: () => ref.invalidate(productsProvider)),
        data: (items) {
          final subscriptions =
              items.where((item) => item.tier != null).toList();
          _selected ??= subscriptions
                  .where(
                    (item) => item.tier == 'gold' && item.durationDays == 30,
                  )
                  .firstOrNull ??
              subscriptions.firstOrNull;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Icon(Icons.favorite, color: Brand.red500, size: 54),
              const SizedBox(height: 8),
              Text(
                'Choose what works for you',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              const Text(
                'Subscriptions do not change who you connect with. They give you more ways to discover.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'LRD', label: Text('LRD')),
                  ButtonSegment(value: 'USD', label: Text('USD')),
                ],
                selected: {
                  _currency,
                },
                onSelectionChanged: (value) =>
                    setState(() => _currency = value.first),
              ),
              const SizedBox(height: 18),
              for (final tier in ['plus', 'gold', 'platinum'])
                _TierCard(
                  tier: tier,
                  products:
                      subscriptions.where((item) => item.tier == tier).toList(),
                  currency: _currency,
                  selected: _selected,
                  onSelected: (value) => setState(() => _selected = value),
                ),
              const SizedBox(height: 12),
              PepperButton(
                label: _buying ? 'Activating…' : 'Continue',
                onPressed: _buying ? null : _buy,
              ),
              const SizedBox(height: 12),
              const Text(
                'Recurring subscriptions can be managed in your app-store account. Prices and availability are confirmed before purchase.',
                textAlign: TextAlign.center,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TierCard extends StatelessWidget {
  const _TierCard({
    required this.tier,
    required this.products,
    required this.currency,
    required this.selected,
    required this.onSelected,
  });
  final String tier;
  final List<BillingProduct> products;
  final String currency;
  final BillingProduct? selected;
  final ValueChanged<BillingProduct> onSelected;

  @override
  Widget build(BuildContext context) {
    const features = {
      'plus': 'Unlimited likes · Rewind · Passport',
      'gold': 'Everything in Plus · See who likes you · Top Picks',
      'platinum': 'Everything in Gold · Read receipts · Priority likes',
    };
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pepper ${tier[0].toUpperCase()}${tier.substring(1)}',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(features[tier]!),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: products.map((product) {
                final amount = currency == 'LRD'
                    ? 'L\$${product.lrd.toStringAsFixed(0)}'
                    : '\$${product.usd.toStringAsFixed(2)}';
                final duration = product.durationDays == 7
                    ? 'week'
                    : product.durationDays == 30
                        ? 'month'
                        : '6 months';
                return ChoiceChip(
                  label: Text('$amount / $duration'),
                  selected: selected?.sku == product.sku,
                  onSelected: (_) => onSelected(product),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}
