import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/features/likes/data/likes_repository.dart';
import 'package:pepper/features/likes/domain/received_like.dart';

final likesControllerProvider =
    AsyncNotifierProvider<LikesController, ReceivedLikes>(LikesController.new);

final class LikesController extends AsyncNotifier<ReceivedLikes> {
  @override
  Future<ReceivedLikes> build() => ref.read(likesRepositoryProvider).received();
  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(likesRepositoryProvider).received(),
    );
  }
}
