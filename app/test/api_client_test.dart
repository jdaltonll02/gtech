import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/core/network/app_exception.dart';
import 'package:pepper/core/storage/token_storage.dart';

import 'support/test_http.dart';

final class MemoryTokenStorage implements TokenStorage {
  MemoryTokenStorage({this.access, this.refresh});

  String? access;
  String? refresh;
  int clearCalls = 0;

  @override
  Future<void> clear() async {
    clearCalls++;
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
  test('adds the access token to API requests', () async {
    final storage = MemoryTokenStorage(access: 'access-token');
    final client = ApiClient(storage);
    final adapter = TestHttpAdapter((_) => jsonResponse({'ok': true}));
    client.dio.httpClientAdapter = adapter;

    await client.dio.get<Map<String, dynamic>>('/profiles/me');

    expect(adapter.requests, hasLength(1));
    expect(
      adapter.requests.single.headers['authorization'],
      'Bearer access-token',
    );
  });

  test('maps the server error envelope to AppException', () async {
    final client = ApiClient(MemoryTokenStorage());
    client.dio.httpClientAdapter = TestHttpAdapter(
      (_) => jsonResponse(
        {
          'error': {
            'code': 'PERMISSION_DENIED',
            'message': 'This action is not allowed.',
            'details': {'field': 'profile'},
          },
        },
        status: 403,
      ),
    );

    await expectLater(
      client.dio.get<void>('/protected'),
      throwsA(
        isA<DioException>().having(
          (error) => error.error,
          'mapped error',
          isA<AppException>()
              .having((error) => error.code, 'code', 'PERMISSION_DENIED')
              .having(
                (error) => error.message,
                'message',
                'This action is not allowed.',
              ),
        ),
      ),
    );
  });

  test('clears local credentials when a 401 cannot be refreshed', () async {
    final storage = MemoryTokenStorage(access: 'expired-token');
    final client = ApiClient(storage);
    client.dio.httpClientAdapter = TestHttpAdapter(
      (_) => jsonResponse(
        {
          'error': {
            'code': 'AUTHENTICATION_REQUIRED',
            'message': 'Sign in to continue.',
          },
        },
        status: 401,
      ),
    );

    await expectLater(
      client.dio.get<void>('/profiles/me'),
      throwsA(isA<DioException>()),
    );
    expect(storage.clearCalls, 1);
    expect(storage.access, isNull);
  });
}
