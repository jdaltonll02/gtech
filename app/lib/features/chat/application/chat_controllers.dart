import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/features/chat/data/chat_repository.dart';
import 'package:pepper/features/chat/domain/chat_models.dart';

final matchesControllerProvider =
    AsyncNotifierProvider<MatchesController, List<MatchSummary>>(
  MatchesController.new,
);

final class MatchesController extends AsyncNotifier<List<MatchSummary>> {
  @override
  Future<List<MatchSummary>> build() =>
      ref.read(chatRepositoryProvider).matches();
  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(chatRepositoryProvider).matches(),
    );
  }
}

final threadControllerProvider =
    AsyncNotifierProviderFamily<ThreadController, ChatThread, String>(
  ThreadController.new,
);

final class ThreadController extends FamilyAsyncNotifier<ChatThread, String> {
  @override
  Future<ChatThread> build(String arg) =>
      ref.read(chatRepositoryProvider).thread(arg);

  Future<void> send(String text) async {
    final clean = text.trim();
    if (clean.isEmpty) return;
    final current = state.requireValue;
    final message = await ref.read(chatRepositoryProvider).sendText(arg, clean);
    state = AsyncData(
      ChatThread(
        currentUserId: current.currentUserId,
        messages: [...current.messages, message],
      ),
    );
    ref.invalidate(matchesControllerProvider);
  }

  Future<void> sendImage() async {
    final current = state.requireValue;
    final message =
        await ref.read(chatRepositoryProvider).pickAndSendImage(arg);
    if (message == null) return;
    state = AsyncData(
      ChatThread(
        currentUserId: current.currentUserId,
        messages: [...current.messages, message],
      ),
    );
    ref.invalidate(matchesControllerProvider);
  }

  Future<void> markLatestRead() async {
    final thread = state.valueOrNull;
    if (thread == null || thread.messages.isEmpty) return;
    final last = thread.messages.last;
    if (last.senderId != thread.currentUserId) {
      await ref.read(chatRepositoryProvider).markRead(arg, last.id);
    }
  }
}
