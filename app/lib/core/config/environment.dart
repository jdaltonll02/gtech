import 'package:flutter/foundation.dart';

abstract final class Environment {
  static const configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const googleClientId = String.fromEnvironment('GOOGLE_CLIENT_ID');
  static const appleClientId = String.fromEnvironment('APPLE_CLIENT_ID');

  static String get apiBaseUrl {
    if (configuredApiBaseUrl.isNotEmpty) return configuredApiBaseUrl;
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:8000'
        : 'http://localhost:8000';
  }
}
