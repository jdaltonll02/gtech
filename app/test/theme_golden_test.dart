import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/theme/app_theme.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';

Widget preview(ThemeData theme) => MaterialApp(
      theme: theme,
      home: Scaffold(
        appBar: AppBar(title: const Text(Brand.appName)),
        body: const Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Meet people who feel like home.',
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
              ),
              SizedBox(height: 24),
              TextField(
                decoration: InputDecoration(labelText: 'Phone number'),
              ),
              SizedBox(height: 16),
              PepperButton(label: 'Continue', onPressed: null),
              SizedBox(height: 16),
              PepperBadge(label: 'NEW MATCH'),
            ],
          ),
        ),
      ),
    );

void main() {
  for (final value in [
    (name: 'light', theme: AppTheme.light()),
    (name: 'dark', theme: AppTheme.dark()),
  ]) {
    testWidgets('${value.name} theme golden', (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 800));
      await tester.pumpWidget(preview(value.theme));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/theme_${value.name}.png'),
      );
      await tester.binding.setSurfaceSize(null);
    });
  }
}
