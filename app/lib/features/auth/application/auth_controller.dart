import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/features/auth/data/auth_repository.dart';
import 'package:pepper/features/auth/domain/auth_models.dart';

final authControllerProvider =
    AsyncNotifierProvider<AuthController, void>(AuthController.new);

final class AuthController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}
  Future<OtpChallenge?> requestOtp(String phone) async {
    state = const AsyncLoading();
    OtpChallenge? result;
    state = await AsyncValue.guard(() async {
      result = await ref.read(authRepositoryProvider).requestOtp(phone);
    });
    return result;
  }

  Future<AuthResult?> verifyOtp(String challengeId, String code) async {
    state = const AsyncLoading();
    AuthResult? result;
    state = await AsyncValue.guard(() async {
      result =
          await ref.read(authRepositoryProvider).verifyOtp(challengeId, code);
    });
    return result;
  }

  Future<AuthResult?> social(String provider) async {
    state = const AsyncLoading();
    AuthResult? result;
    state = await AsyncValue.guard(() async {
      result = await ref.read(authRepositoryProvider).social(provider);
    });
    return result;
  }
}
