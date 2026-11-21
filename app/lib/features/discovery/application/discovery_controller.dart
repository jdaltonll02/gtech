import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/features/discovery/data/discovery_repository.dart';
import 'package:pepper/features/discovery/domain/discovery_card.dart';

final discoveryControllerProvider =
    AsyncNotifierProvider<DiscoveryController, List<DiscoveryCardModel>>(
  DiscoveryController.new,
);

final class DiscoveryController
    extends AsyncNotifier<List<DiscoveryCardModel>> {
  @override
  Future<List<DiscoveryCardModel>> build() =>
      ref.read(discoveryRepositoryProvider).deck();

  Future<Map<String, dynamic>> swipe(
    DiscoveryCardModel card,
    SwipeAction action,
  ) async {
    final previous = state.requireValue;
    state = AsyncData(previous.where((item) => item.id != card.id).toList());
    try {
      return await ref.read(discoveryRepositoryProvider).swipe(card.id, action);
    } catch (_) {
      state = AsyncData(previous);
      rethrow;
    }
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(discoveryRepositoryProvider).deck(),
    );
  }

  Future<void> rewind() async {
    await ref.read(discoveryRepositoryProvider).rewind();
    await reload();
  }

  Future<Map<String, dynamic>> activateBoost() =>
      ref.read(discoveryRepositoryProvider).activateBoost();
}
