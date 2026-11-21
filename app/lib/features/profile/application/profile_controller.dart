import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/features/profile/data/profile_repository.dart';
import 'package:pepper/features/profile/domain/own_profile.dart';

final profileControllerProvider =
    AsyncNotifierProvider<ProfileController, OwnProfile>(ProfileController.new);

final class ProfileController extends AsyncNotifier<OwnProfile> {
  @override
  Future<OwnProfile> build() => ref.read(profileRepositoryProvider).get();
  Future<void> reload() async {
    state = const AsyncLoading();
    state =
        await AsyncValue.guard(() => ref.read(profileRepositoryProvider).get());
  }

  Future<void> saveProfile({
    required String bio,
    required String jobTitle,
    required String school,
    required String county,
    required List<String> languages,
  }) async {
    state = AsyncData(
      await ref.read(profileRepositoryProvider).update(
            bio: bio,
            jobTitle: jobTitle,
            school: school,
            county: county,
            languages: languages,
          ),
    );
  }
}
