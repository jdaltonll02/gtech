final class OwnProfile {
  const OwnProfile({
    required this.userId,
    required this.name,
    required this.bio,
    required this.jobTitle,
    required this.school,
    required this.county,
    required this.languages,
    required this.goal,
    required this.completeness,
    required this.verified,
    required this.verificationStatus,
  });

  factory OwnProfile.fromJson(Map<String, dynamic> json) => OwnProfile(
        userId: json['user_id'] as String,
        name: json['display_name'] as String? ?? 'Pepper member',
        bio: json['bio'] as String? ?? '',
        jobTitle: json['job_title'] as String? ?? '',
        school: json['school'] as String? ?? '',
        county: json['county'] as String? ?? '',
        languages: (json['languages'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(),
        goal: json['relationship_goal'] as String? ?? '',
        completeness: json['completeness'] as int? ?? 0,
        verified: json['is_verified'] as bool? ?? false,
        verificationStatus:
            json['verification_status'] as String? ?? 'unverified',
      );

  final String userId;
  final String name;
  final String bio;
  final String jobTitle;
  final String school;
  final String county;
  final List<String> languages;
  final String goal;
  final int completeness;
  final bool verified;
  final String verificationStatus;
}
