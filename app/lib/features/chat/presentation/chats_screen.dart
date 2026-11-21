import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/chat/application/chat_controllers.dart';

class ChatsScreen extends ConsumerWidget {
  const ChatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matches = ref.watch(matchesControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Chats')),
      body: matches.when(
        loading: () => const Center(
          child: PepperProgressIndicator(label: 'Loading conversations'),
        ),
        error: (_, __) => PepperErrorView(
          onRetry: () => ref.read(matchesControllerProvider.notifier).reload(),
        ),
        data: (items) => items.isEmpty
            ? const PepperEmptyState(
                icon: Icons.chat_bubble_outline,
                title: 'No conversations yet',
                body:
                    'When you connect with someone, start the conversation here.',
              )
            : RefreshIndicator(
                onRefresh: ref.read(matchesControllerProvider.notifier).reload,
                child: ListView.separated(
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final match = items[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 6,
                      ),
                      leading: PepperAvatar(label: match.name),
                      title: Text(
                        match.name,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        match.lastMessage,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            DateFormat.MMMd().format(match.createdAt),
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                          if (match.unreadCount > 0)
                            Padding(
                              padding: const EdgeInsets.only(top: 5),
                              child: PepperBadge(label: '${match.unreadCount}'),
                            ),
                        ],
                      ),
                      onTap: () => context.push(
                        '/chats/${match.id}',
                        extra: {
                          'name': match.name,
                          'user_id': match.otherUserId,
                        },
                      ),
                    );
                  },
                ),
              ),
      ),
    );
  }
}
