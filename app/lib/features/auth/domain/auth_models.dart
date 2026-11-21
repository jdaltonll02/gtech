final class OtpChallenge {
  const OtpChallenge({required this.id, required this.expiresIn});
  factory OtpChallenge.fromJson(Map<String, dynamic> json) => OtpChallenge(
        id: json['challenge_id'] as String,
        expiresIn: json['expires_in'] as int,
      );
  final String id;
  final int expiresIn;
}

final class AuthResult {
  const AuthResult({
    required this.access,
    required this.refresh,
    required this.isNewUser,
  });
  factory AuthResult.fromJson(Map<String, dynamic> json) => AuthResult(
        access: json['access'] as String,
        refresh: json['refresh'] as String,
        isNewUser: json['is_new_user'] as bool,
      );
  final String access;
  final String refresh;
  final bool isNewUser;
}
