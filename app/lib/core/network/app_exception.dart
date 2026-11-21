final class AppException implements Exception {
  const AppException({required this.code, required this.message, this.details});
  final String code;
  final String message;
  final Object? details;
  @override
  String toString() => 'AppException($code, $message)';
}
