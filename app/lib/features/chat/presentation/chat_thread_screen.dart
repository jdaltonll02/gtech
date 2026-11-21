import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/chat/application/chat_controllers.dart';
import 'package:pepper/features/chat/data/chat_repository.dart';
import 'package:pepper/features/chat/domain/chat_models.dart';

class ChatThreadScreen extends ConsumerStatefulWidget {
  const ChatThreadScreen({
    required this.matchId,
    required this.name,
    required this.otherUserId,
    super.key,
  });
  final String matchId;
  final String name;
  final String otherUserId;

  @override
  ConsumerState<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends ConsumerState<ChatThreadScreen> {
  final _composer = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _composer.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_sending || _composer.text.trim().isEmpty) return;
    final text = _composer.text;
    setState(() => _sending = true);
    try {
      await ref
          .read(threadControllerProvider(widget.matchId).notifier)
          .send(text);
      _composer.clear();
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Message could not be sent. Try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendImage() async {
    if (_sending) return;
    setState(() => _sending = true);
    try {
      await ref
          .read(threadControllerProvider(widget.matchId).notifier)
          .sendImage();
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo could not be sent.')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(threadControllerProvider(widget.matchId));
    ref.listen(threadControllerProvider(widget.matchId), (_, next) {
      if (next.hasValue) {
        ref
            .read(threadControllerProvider(widget.matchId).notifier)
            .markLatestRead();
      }
    });
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            PepperAvatar(label: widget.name, radius: 18),
            const SizedBox(width: 10),
            Text(widget.name),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Conversation safety options',
            onPressed: () => _showSafety(context),
            icon: const Icon(Icons.shield_outlined),
          ),
        ],
      ),
      body: state.when(
        loading: () => const Center(
          child: PepperProgressIndicator(label: 'Loading messages'),
        ),
        error: (_, __) => PepperErrorView(
          onRetry: () =>
              ref.invalidate(threadControllerProvider(widget.matchId)),
        ),
        data: (thread) => Column(
          children: [
            Expanded(
              child: thread.messages.isEmpty
                  ? PepperEmptyState(
                      icon: Icons.waving_hand_outlined,
                      title: 'Start with hello',
                      body:
                          'Ask about something from ${widget.name}’s profile.',
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(14),
                      itemCount: thread.messages.length,
                      itemBuilder: (_, index) {
                        final message = thread.messages[index];
                        return _MessageBubble(
                          message: message,
                          mine: message.senderId == thread.currentUserId,
                        );
                      },
                    ),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Send a photo',
                      onPressed: _sending ? null : _sendImage,
                      icon: const Icon(Icons.add_photo_alternate_outlined),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _composer,
                        textCapitalization: TextCapitalization.sentences,
                        maxLength: 2000,
                        maxLines: 5,
                        minLines: 1,
                        decoration: const InputDecoration(
                          hintText: 'Message',
                          counterText: '',
                        ),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    IconButton.filled(
                      tooltip: 'Send message',
                      onPressed: _sending ? null : _send,
                      icon: _sending
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Brand.white,
                              ),
                            )
                          : const Icon(Icons.send),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showSafety(BuildContext context) => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (_) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Stay in control',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Never send money or share verification codes. Report suspicious requests.',
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _report();
                  },
                  icon: const Icon(Icons.flag_outlined),
                  label: const Text('Report this person'),
                ),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _block();
                  },
                  icon: const Icon(Icons.block),
                  label: const Text('Block this person'),
                ),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _unmatch();
                  },
                  icon: const Icon(Icons.link_off),
                  label: const Text('Unmatch'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ],
            ),
          ),
        ),
      );

  Future<void> _report() async {
    const reasons = {
      'fake_profile': 'Fake profile',
      'underage': 'May be under 18',
      'harassment': 'Harassment',
      'scam': 'Scam or money request',
      'nudity': 'Inappropriate photo',
      'offensive': 'Offensive behaviour',
      'other': 'Something else',
    };
    final reason = await showDialog<String>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: const Text('Why are you reporting?'),
        children: reasons.entries
            .map(
              (entry) => SimpleDialogOption(
                onPressed: () => Navigator.pop(dialogContext, entry.key),
                child: Text(entry.value),
              ),
            )
            .toList(),
      ),
    );
    if (reason == null || widget.otherUserId.isEmpty) return;
    await ref.read(chatRepositoryProvider).report(
          userId: widget.otherUserId,
          matchId: widget.matchId,
          reason: reason,
          details: '',
        );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Report received. Thank you.')),
    );
  }

  Future<void> _block() async {
    if (widget.otherUserId.isEmpty) return;
    await ref.read(chatRepositoryProvider).block(widget.otherUserId);
    ref.invalidate(matchesControllerProvider);
    if (mounted) context.go('/chats');
  }

  Future<void> _unmatch() async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text('Unmatch ${widget.name}?'),
            content: const Text('The conversation will close for both of you.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Unmatch'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    await ref.read(chatRepositoryProvider).unmatch(widget.matchId);
    ref.invalidate(matchesControllerProvider);
    if (mounted) context.go('/chats');
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.mine});
  final ChatMessage message;
  final bool mine;

  @override
  Widget build(BuildContext context) => Align(
        alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment:
                mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (message.safetyWarning)
                const Padding(
                  padding: EdgeInsets.only(bottom: 4),
                  child: PepperBadge(
                    label: 'Be careful with money or contact requests',
                  ),
                ),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: mine
                      ? Brand.red500
                      : Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  child: message.kind == 'image' && message.mediaUrl != null
                      ? SizedBox(
                          width: 190,
                          height: 220,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: PepperImage(url: message.mediaUrl!),
                          ),
                        )
                      : Text(
                          message.body,
                          style: TextStyle(color: mine ? Brand.white : null),
                        ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 2, left: 5, right: 5),
                child: Text(
                  '${DateFormat.jm().format(message.createdAt.toLocal())}${mine && message.readAt != null ? ' · Read' : ''}',
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
            ],
          ),
        ),
      );
}
