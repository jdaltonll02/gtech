import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/router/app_router.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:pepper/core/theme/app_theme.dart';

final router = createRouter(const SecureTokenStorage());

void main() => runApp(ProviderScope(child: PepperApp(routerConfig: router)));

class PepperApp extends StatelessWidget {
  const PepperApp({required this.routerConfig, super.key});
  final GoRouter routerConfig;

  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: Brand.appName,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        routerConfig: routerConfig,
      );
}
