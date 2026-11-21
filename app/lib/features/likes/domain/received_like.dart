final class ReceivedLike {
  const ReceivedLike({
    required this.id,
    required this.name,
    required this.age,
    required this.verified,
    required this.photoUrl,
    required this.superlike,
  });

  factory ReceivedLike.fromJson(Map<String, dynamic> json) => ReceivedLike(
        id: json['id'] as String,
        name: json['name'] as String,
        age: json['age'] as int,
        verified: json['verified'] as bool? ?? false,
        photoUrl: json['photo_url'] as String?,
        superlike: json['superlike'] as bool? ?? false,
      );

  final String id;
  final String name;
  final int age;
  final bool verified;
  final String? photoUrl;
  final bool superlike;
}

final class ReceivedLikes {
  const ReceivedLikes({
    required this.count,
    required this.likes,
    required this.locked,
  });

  factory ReceivedLikes.fromJson(Map<String, dynamic> json) => ReceivedLikes(
        count: json['count'] as int,
        likes: (json['results'] as List<dynamic>? ?? const [])
            .map(
              (value) => ReceivedLike.fromJson(value as Map<String, dynamic>),
            )
            .toList(),
        locked: !json.containsKey('results'),
      );

  final int count;
  final List<ReceivedLike> likes;
  final bool locked;
}
