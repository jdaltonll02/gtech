import 'package:flutter/material.dart';
import 'package:pepper/core/config/brand.dart';

abstract final class AppTheme {
  static ThemeData light() => _theme(Brightness.light);
  static ThemeData dark() => _theme(Brightness.dark);

  static ThemeData _theme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme(
      brightness: brightness,
      primary: Brand.red500,
      onPrimary: Brand.white,
      secondary: Brand.red700,
      onSecondary: Brand.white,
      error: Brand.red700,
      onError: Brand.white,
      surface: dark ? Brand.ink900 : Brand.white,
      onSurface: dark ? Brand.white : Brand.ink900,
    );
    return ThemeData(
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? Brand.black : Brand.white,
      cardColor: dark ? Brand.ink800 : Brand.white,
      textTheme: ThemeData(brightness: brightness)
          .textTheme
          .apply(fontFamily: 'Inter'),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: dark ? Brand.black : Brand.white,
        foregroundColor: dark ? Brand.white : Brand.ink900,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: dark ? Brand.ink900 : Brand.white,
        indicatorColor: Brand.red500.withValues(alpha: .14),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: dark ? Brand.ink800 : Brand.grey100,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Brand.red500, width: 2),
        ),
      ),
      useMaterial3: true,
    );
  }
}
