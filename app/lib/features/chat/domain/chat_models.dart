final class MatchSummary {
  const MatchSummary({
    required this.id,
    required this.otherUserId,
    required this.name,
    required this.lastMessage,
    required this.unreadCount,
    required this.createdAt,
  });

  factory MatchSummary.fromJson(Map<String, dynamic> json) {
    final other = json['other_user'] as Map<String, dynamic>;
    final last = json['last_message'] as Map<String, dynamic>?;
    return MatchSummary(
      id: json['id'] as String,
      otherUserId: other['id'] as String,
      name: other['display_name'] as String? ?? 'Pepper member',
      lastMessage: last?['body'] as String? ??
          (last?['kind'] == 'image'
              ? 'Sent a photo'
              : 'You connected on Pepper'),
      unreadCount: json['unread_count'] as int? ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  final String id;
  final String otherUserId;
  final String name;
  final String lastMessage;
  final int unreadCount;
  final DateTime createdAt;
}

final class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.senderId,
    required this.kind,
    required this.body,
    required this.mediaUrl,
    required this.safetyWarning,
    required this.createdAt,
    required this.readAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        senderId: json['sender_id'] as String,
        kind: json['kind'] as String,
        body: json['body'] as String? ?? '',
        mediaUrl: json['media_url'] as String?,
        safetyWarning: json['safety_warning'] as bool? ?? false,
        createdAt: DateTime.parse(json['created_at'] as String),
        readAt: json['read_at'] == null
            ? null
            : DateTime.parse(json['read_at'] as String),
      );

  final String id;
  final String senderId;
  final String kind;
  final String body;
  final String? mediaUrl;
  final bool safetyWarning;
  final DateTime createdAt;
  final DateTime? readAt;
}

final class ChatThread {
  const ChatThread({required this.currentUserId, required this.messages});
  final String currentUserId;
  final List<ChatMessage> messages;
}
