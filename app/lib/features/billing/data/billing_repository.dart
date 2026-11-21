import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/features/billing/domain/billing_product.dart';

final billingRepositoryProvider = Provider<BillingRepository>(
  (ref) => BillingRepository(ref.watch(dioProvider)),
);

final class BillingRepository {
  const BillingRepository(this._dio);
  final Dio _dio;

  Future<List<BillingProduct>> products() async {
    final response = await _dio.get<Map<String, dynamic>>('/billing/products');
    return (response.data!['results'] as List<dynamic>)
        .map((value) => BillingProduct.fromJson(value as Map<String, dynamic>))
        .where((product) => product.kind == 'subscription')
        .toList();
  }

  Future<void> verifyFake(BillingProduct product) => _dio.post<void>(
        '/billing/verify',
        data: {
          'provider': 'fake',
          'product_sku': product.sku,
          'receipt': 'flutter-debug-${DateTime.now().microsecondsSinceEpoch}',
          'currency': 'USD',
        },
      );

  Future<void> purchaseStore(BillingProduct product) async {
    final store = InAppPurchase.instance;
    if (!await store.isAvailable()) {
      throw StateError('The app store is unavailable.');
    }
    final productId = Platform.isIOS ? product.iosId : product.androidId;
    final query = await store.queryProductDetails({productId});
    if (query.error != null || query.productDetails.isEmpty) {
      throw StateError('This product is unavailable.');
    }
    final completion = Completer<PurchaseDetails>();
    late StreamSubscription<List<PurchaseDetails>> subscription;
    subscription = store.purchaseStream.listen((purchases) async {
      for (final purchase
          in purchases.where((item) => item.productID == productId)) {
        if (purchase.status == PurchaseStatus.error) {
          if (!completion.isCompleted) {
            completion.completeError(
              purchase.error ?? StateError('Purchase failed.'),
            );
          }
        } else if (purchase.status == PurchaseStatus.purchased ||
            purchase.status == PurchaseStatus.restored) {
          if (!completion.isCompleted) completion.complete(purchase);
        }
        if (purchase.pendingCompletePurchase) {
          await store.completePurchase(purchase);
        }
      }
    });
    try {
      final started = await store.buyNonConsumable(
        purchaseParam: PurchaseParam(
          productDetails: query.productDetails.first,
        ),
      );
      if (!started) throw StateError('Purchase did not start.');
      final purchase =
          await completion.future.timeout(const Duration(minutes: 3));
      await _dio.post<void>(
        '/billing/verify',
        data: {
          'provider': Platform.isIOS ? 'apple' : 'google',
          'product_sku': product.sku,
          'receipt': purchase.verificationData.serverVerificationData,
          'currency': 'USD',
        },
      );
    } finally {
      await subscription.cancel();
    }
  }
}
