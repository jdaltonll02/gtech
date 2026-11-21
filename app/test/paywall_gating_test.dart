import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/features/likes/data/likes_repository.dart';
import 'package:pepper/features/likes/presentation/likes_screen.dart';

void main() {
  testWidgets('free tier sees a gated Likes You call to action',
      (tester) async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) => handler.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 200,
            data: {
              'count': 4,
              'blurred': [
                {'blurhash': 'example'},
              ],
            },
          ),
        ),
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          likesRepositoryProvider.overrideWithValue(LikesRepository(dio)),
        ],
        child: const MaterialApp(home: LikesScreen()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('4 people like you'), findsOneWidget);
    expect(find.text('See upgrade options'), findsOneWidget);
  });
}
