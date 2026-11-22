import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/core/router/app_router.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:pepper/features/auth/data/auth_repository.dart';
import 'package:pepper/main.dart';

import 'support/test_http.dart';

final class FlowTokenStorage implements TokenStorage {
  String? access;
  String? refresh;

  @override
  Future<void> clear() async {
    access = null;
    refresh = null;
  }

  @override
  Future<String?> readAccessToken() async => access;

  @override
  Future<String?> readRefreshToken() async => refresh;

  @override
  Future<void> writeTokens({
    required String access,
    required String refresh,
  }) async {
    this.access = access;
    this.refresh = refresh;
  }
}

void main() {
  testWidgets('requests an OTP and opens the challenge screen', (tester) async {
    final storage = FlowTokenStorage();
    final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'));
    final adapter = TestHttpAdapter(
      (_) => jsonResponse(
        {
          'challenge_id': '01900000-0000-7000-8000-000000000001',
          'expires_in': 300,
        },
        status: 201,
      ),
    );
    dio.httpClientAdapter = adapter;
    final router = createRouter(storage);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(
            AuthRepository(dio, storage),
          ),
        ],
        child: PepperApp(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(EditableText), '770000001');
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(adapter.requests, hasLength(1));
    expect(adapter.requests.single.path, '/auth/otp/request');
    expect(
      adapter.requests.single.data,
      {'phone': '+231770000001'},
    );
    expect(find.text('Enter your code'), findsOneWidget);
    expect(find.text('We sent six digits to +231 770000001'), findsOneWidget);

    router.dispose();
    await tester.pumpWidget(const SizedBox());
  });
}
