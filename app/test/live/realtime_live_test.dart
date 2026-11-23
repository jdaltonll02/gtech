import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/core/realtime/realtime_service.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:pepper/features/auth/data/auth_repository.dart';

const _enabled = bool.fromEnvironment('RUN_LIVE_REALTIME_TEST');
const _accessToken = String.fromEnvironment('E2E_ACCESS_TOKEN');
const _matchId = String.fromEnvironment('E2E_MATCH_ID');
const _phone = String.fromEnvironment(
  'E2E_PHONE',
  defaultValue: '+231770000001',
);
const _otp = String.fromEnvironment('E2E_OTP', defaultValue: '000000');

final class _LiveTokenStorage implements TokenStorage {
  _LiveTokenStorage(this.access);

  String? access;
  String? refresh;

  @override
  Future<void> clear() async => access = null;

  @override
  Future<String?> readAccessToken() async => access;

  @override
  Future<String?> readRefreshToken() async => refresh;

  @override
  Future<void> writeTokens({
    required String access,
    required String refresh,
  }) async {
    this.access = access;
    this.refresh = refresh;
  }
}

String _uuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  String hex(int value) => value.toRadixString(16).padLeft(2, '0');
  final value = bytes.map(hex).join();
  return '${value.substring(0, 8)}-'
      '${value.substring(8, 12)}-'
      '${value.substring(12, 16)}-'
      '${value.substring(16, 20)}-'
      '${value.substring(20)}';
}

void main() {
  test(
    'mobile service connects, resyncs, sends, receives, and reconciles',
    () async {
      final startedAt = DateTime.now().toUtc().subtract(
            const Duration(seconds: 2),
          );
      final storage = _LiveTokenStorage(
        _accessToken.isEmpty ? null : _accessToken,
      );
      final api = ApiClient(storage);
      if (_accessToken.isEmpty) {
        final auth = AuthRepository(api.dio, storage);
        final challenge = await auth.requestOtp(_phone);
        await auth.verifyOtp(challenge.id, _otp);
      }

      var matchId = _matchId;
      if (matchId.isEmpty) {
        final matches = await api.dio.get<Map<String, dynamic>>(
          '/matches',
          queryParameters: {'limit': 1},
        );
        final results = matches.data?['results'] as List<dynamic>? ?? const [];
        expect(
          results,
          isNotEmpty,
          reason: 'The live account needs at least one active match.',
        );
        matchId = (results.first as Map<String, dynamic>)['id'] as String;
      }

      final realtime = RealtimeService(storage, api.dio);
      addTearDown(realtime.dispose);

      final synchronized = realtime.events
          .firstWhere((event) => event.type == 'sync.completed')
          .timeout(const Duration(seconds: 15));
      await realtime.connect();
      await synchronized;

      final body = 'Flutter realtime acceptance ${DateTime.now().toUtc()}';
      final received = realtime.events
          .firstWhere(
            (event) =>
                event.type == 'message.new' &&
                event.data is Map<String, dynamic> &&
                (event.data! as Map<String, dynamic>)['body'] == body,
          )
          .timeout(const Duration(seconds: 15));
      realtime.send('message.send', {
        'match_id': matchId,
        'client_id': _uuid(),
        'kind': 'text',
        'body': body,
      });

      final event = await received;
      final message = event.data! as Map<String, dynamic>;
      expect(message['match_id'], matchId);

      final response = await api.dio.get<Map<String, dynamic>>(
        '/sync',
        queryParameters: {'since': startedAt.toIso8601String()},
      );
      final messages = response.data?['messages'] as List<dynamic>? ?? const [];
      expect(
        messages.whereType<Map<String, dynamic>>().any(
              (candidate) =>
                  candidate['id'] == message['id'] && candidate['body'] == body,
            ),
        isTrue,
      );
    },
    skip: _enabled
        ? false
        : 'Set RUN_LIVE_REALTIME_TEST to exercise a running local stack.',
  );
}
