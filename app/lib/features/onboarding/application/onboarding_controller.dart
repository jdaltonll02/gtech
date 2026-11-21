import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/features/onboarding/data/onboarding_repository.dart';

final onboardingControllerProvider =
    AsyncNotifierProvider<OnboardingController, void>(OnboardingController.new);

final class OnboardingController extends AsyncNotifier<void> {
  @override
  Future<void> build() => Future.value();
  Future<bool> run(
    Future<void> Function(OnboardingRepository) operation,
  ) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => operation(ref.read(onboardingRepositoryProvider)),
    );
    return !state.hasError;
  }
}
