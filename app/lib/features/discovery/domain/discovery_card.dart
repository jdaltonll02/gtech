final class DiscoveryPhoto {
  const DiscoveryPhoto({
    required this.medium,
    required this.large,
    required this.blurhash,
  });

  factory DiscoveryPhoto.fromJson(Map<String, dynamic> json) => DiscoveryPhoto(
        medium: json['md'] as String,
        large: json['lg'] as String,
        blurhash: json['blurhash'] as String? ?? '',
      );

  final String medium;
  final String large;
  final String blurhash;
}

final class DiscoveryCardModel {
  const DiscoveryCardModel({
    required this.id,
    required this.name,
    required this.age,
    required this.distanceLabel,
    required this.county,
    required this.jobTitle,
    required this.school,
    required this.bio,
    required this.interests,
    required this.photos,
    required this.verified,
    required this.superlikedYou,
  });

  factory DiscoveryCardModel.fromJson(Map<String, dynamic> json) =>
      DiscoveryCardModel(
        id: json['id'] as String,
        name: json['name'] as String,
        age: json['age'] as int,
        distanceLabel: json['distance_label'] as String,
        county: json['county'] as String? ?? '',
        jobTitle: json['job_title'] as String? ?? '',
        school: json['school'] as String? ?? '',
        bio: json['bio'] as String? ?? '',
        interests: (json['interests'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(),
        photos: (json['photos'] as List<dynamic>)
            .map(
              (value) => DiscoveryPhoto.fromJson(value as Map<String, dynamic>),
            )
            .toList(),
        verified: json['verified'] as bool? ?? false,
        superlikedYou: json['superliked_you'] as bool? ?? false,
      );

  final String id;
  final String name;
  final int age;
  final String distanceLabel;
  final String county;
  final String jobTitle;
  final String school;
  final String bio;
  final List<String> interests;
  final List<DiscoveryPhoto> photos;
  final bool verified;
  final bool superlikedYou;
}

enum SwipeAction { nope, like, superlike }
