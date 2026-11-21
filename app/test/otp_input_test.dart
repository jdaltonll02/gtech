import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/features/auth/presentation/otp_screen.dart';

void main() {
  testWidgets('OTP input advances across six boxes', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: OtpScreen(challengeId: 'challenge', phone: '770000001'),
        ),
      ),
    );
    for (var index = 0; index < 6; index++) {
      final field = find.byKey(ValueKey('otp-$index'));
      await tester.enterText(field, '${index + 1}');
      await tester.pump();
    }
    for (var index = 0; index < 6; index++) {
      final field =
          tester.widget<TextField>(find.byKey(ValueKey('otp-$index')));
      expect(field.controller?.text, '${index + 1}');
    }
    await tester.pumpWidget(const SizedBox());
  });
}
