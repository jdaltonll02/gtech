import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:pepper/core/config/environment.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:pepper/features/auth/domain/auth_models.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) =>
      AuthRepository(ref.watch(dioProvider), ref.watch(tokenStorageProvider)),
);

final class AuthRepository {
  const AuthRepository(this._dio, this._storage);
  final Dio _dio;
  final TokenStorage _storage;
  Future<OtpChallenge> requestOtp(String phone) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/request',
      data: {'phone': phone},
    );
    return OtpChallenge.fromJson(response.data!);
  }

  Future<AuthResult> verifyOtp(String challengeId, String code) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/otp/verify',
      data: {'challenge_id': challengeId, 'code': code},
    );
    final result = AuthResult.fromJson(response.data!);
    await _storage.writeTokens(access: result.access, refresh: result.refresh);
    return result;
  }

  Future<AuthResult?> social(String provider) async {
    String? idToken;
    if (provider == 'google') {
      final account = await GoogleSignIn(
        serverClientId: Environment.googleClientId,
      ).signIn();
      if (account == null) return null;
      idToken = (await account.authentication).idToken;
    } else {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email],
      );
      idToken = credential.identityToken;
    }
    if (idToken == null) return null;
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/social/$provider',
      data: {'id_token': idToken},
    );
    final result = AuthResult.fromJson(response.data!);
    await _storage.writeTokens(access: result.access, refresh: result.refresh);
    return result;
  }
}
