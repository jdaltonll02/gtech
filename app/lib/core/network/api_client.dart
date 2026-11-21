import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/config/environment.dart';
import 'package:pepper/core/network/app_exception.dart';
import 'package:pepper/core/storage/token_storage.dart';

final tokenStorageProvider =
    Provider<TokenStorage>((_) => const SecureTokenStorage());
final dioProvider =
    Provider<Dio>((ref) => ApiClient(ref.watch(tokenStorageProvider)).dio);

final class ApiClient {
  ApiClient(this._storage)
      : dio = Dio(
          BaseOptions(
            baseUrl: '${Environment.apiBaseUrl}/api/v1',
            connectTimeout: const Duration(seconds: 12),
            receiveTimeout: const Duration(seconds: 20),
          ),
        ) {
    dio.interceptors
        .add(InterceptorsWrapper(onRequest: _authorize, onError: _handleError));
  }
  final TokenStorage _storage;
  final Dio dio;
  Future<void>? _refreshing;

  Future<void> _authorize(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.readAccessToken();
    if (token != null) options.headers['authorization'] = 'Bearer $token';
    handler.next(options);
  }

  Future<void> _handleError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    if (error.response?.statusCode == 401 &&
        error.requestOptions.extra['retried'] != true &&
        !error.requestOptions.path.endsWith('/auth/refresh')) {
      try {
        _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
        await _refreshing;
        final token = await _storage.readAccessToken();
        final request = error.requestOptions..extra['retried'] = true;
        request.headers['authorization'] = 'Bearer $token';
        handler.resolve(await dio.fetch<Object?>(request));
        return;
      } on Object {
        await _storage.clear();
      }
    }
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final payload = data['error'];
      if (payload is Map<String, dynamic>) {
        handler.reject(
          DioException(
            requestOptions: error.requestOptions,
            response: error.response,
            type: error.type,
            error: AppException(
              code: payload['code'] as String? ?? 'REQUEST_FAILED',
              message: payload['message'] as String? ?? 'Something went wrong.',
              details: payload['details'],
            ),
          ),
        );
        return;
      }
    }
    handler.next(error);
  }

  Future<void> _refresh() async {
    final refresh = await _storage.readRefreshToken();
    if (refresh == null) {
      throw const AppException(
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in to continue.',
      );
    }
    final response = await Dio(BaseOptions(baseUrl: dio.options.baseUrl))
        .post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refresh': refresh},
    );
    final body = response.data!;
    await _storage.writeTokens(
      access: body['access'] as String,
      refresh: body['refresh'] as String,
    );
  }
}
