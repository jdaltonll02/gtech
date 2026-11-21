import 'package:flutter/material.dart';

abstract final class Brand {
  static const appName =
      String.fromEnvironment('APP_NAME', defaultValue: 'Pepper');
  static const red500 = Color(0xFFE0102D);
  static const red700 = Color(0xFFBF0A30);
  static const red300 = Color(0xFFFF4D63);
  static const black = Color(0xFF000000);
  static const ink900 = Color(0xFF0E0E10);
  static const ink800 = Color(0xFF1A1A1D);
  static const ink600 = Color(0xFF3A3A40);
  static const grey400 = Color(0xFF8E8E93);
  static const grey100 = Color(0xFFF2F2F4);
  static const white = Color(0xFFFFFFFF);

  static const gradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [red300, red500, red700],
  );
}
