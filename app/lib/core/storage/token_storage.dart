import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class TokenStorage {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> writeTokens({required String access, required String refresh});
  Future<void> clear();
}

final class SecureTokenStorage implements TokenStorage {
  const SecureTokenStorage([this._storage = const FlutterSecureStorage()]);
  final FlutterSecureStorage _storage;
  static const _accessKey = 'pepper_access_token';
  static const _refreshKey = 'pepper_refresh_token';

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessKey);
  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshKey);
  @override
  Future<void> writeTokens({
    required String access,
    required String refresh,
  }) async {
    await _storage.write(key: _accessKey, value: access);
    await _storage.write(key: _refreshKey, value: refresh);
  }

  @override
  Future<void> clear() => _storage.deleteAll();
}
