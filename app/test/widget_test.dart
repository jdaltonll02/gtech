import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/core/router/app_router.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:pepper/main.dart';

final class TestTokenStorage implements TokenStorage {
  @override
  Future<void> clear() => Future.value();
  @override
  Future<String?> readAccessToken() => Future.value();
  @override
  Future<String?> readRefreshToken() => Future.value();
  @override
  Future<void> writeTokens({required String access, required String refresh}) =>
      Future.value();
}

void main() {
  testWidgets('opens phone authentication', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: PepperApp(routerConfig: createRouter(TestTokenStorage())),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Pepper'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
  });
}
