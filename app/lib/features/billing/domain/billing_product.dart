final class BillingProduct {
  const BillingProduct({
    required this.sku,
    required this.kind,
    required this.tier,
    required this.durationDays,
    required this.usd,
    required this.lrd,
    required this.iosId,
    required this.androidId,
  });

  factory BillingProduct.fromJson(Map<String, dynamic> json) {
    final prices = json['prices'] as Map<String, dynamic>;
    final storeIds = json['store_product_ids'] as Map<String, dynamic>;
    return BillingProduct(
      sku: json['sku'] as String,
      kind: json['kind'] as String,
      tier: json['tier'] as String?,
      durationDays: json['duration_days'] as int?,
      usd: (prices['USD'] as num).toDouble(),
      lrd: (prices['LRD'] as num).toDouble(),
      iosId: storeIds['ios'] as String,
      androidId: storeIds['android'] as String,
    );
  }

  final String sku;
  final String kind;
  final String? tier;
  final int? durationDays;
  final double usd;
  final double lrd;
  final String iosId;
  final String androidId;
}
