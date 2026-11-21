import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/features/chat/domain/chat_models.dart';

final chatRepositoryProvider =
    Provider<ChatRepository>((ref) => ChatRepository(ref.watch(dioProvider)));

final class ChatRepository {
  const ChatRepository(this._dio);
  final Dio _dio;

  Future<List<MatchSummary>> matches() async {
    final response = await _dio
        .get<Map<String, dynamic>>('/matches', queryParameters: {'limit': 50});
    return (response.data!['results'] as List<dynamic>)
        .map((value) => MatchSummary.fromJson(value as Map<String, dynamic>))
        .toList();
  }

  Future<ChatThread> thread(String matchId) async {
    final responses = await Future.wait([
      _dio.get<Map<String, dynamic>>(
        '/matches/$matchId/messages',
        queryParameters: {'limit': 50},
      ),
      _dio.get<Map<String, dynamic>>('/profiles/me'),
    ]);
    final body = responses[0].data!;
    final profile = responses[1].data!;
    return ChatThread(
      currentUserId: profile['user_id'] as String,
      messages: (body['results'] as List<dynamic>)
          .map((value) => ChatMessage.fromJson(value as Map<String, dynamic>))
          .toList()
          .reversed
          .toList(),
    );
  }

  Future<ChatMessage> sendText(String matchId, String body) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/matches/$matchId/messages',
      data: {'client_id': _uuidV4(), 'kind': 'text', 'body': body},
    );
    return ChatMessage.fromJson(response.data!);
  }

  Future<ChatMessage?> pickAndSendImage(String matchId) async {
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (picked == null) return null;
    final file = File(picked.path);
    final signed = (await _dio.post<Map<String, dynamic>>(
      '/chat/upload-url',
      data: {
        'content_type': 'image/jpeg',
        'content_length': await file.length(),
      },
    ))
        .data!;
    await _dio.putUri<void>(
      Uri.parse(signed['upload_url'] as String),
      data: file.openRead(),
      options: Options(
        headers: {...(signed['required_headers'] as Map<String, dynamic>)},
        contentType: 'image/jpeg',
      ),
    );
    final response = await _dio.post<Map<String, dynamic>>(
      '/matches/$matchId/messages',
      data: {
        'client_id': _uuidV4(),
        'kind': 'image',
        'media_key': signed['key'],
      },
    );
    return ChatMessage.fromJson(response.data!);
  }

  Future<void> markRead(String matchId, String messageId) => _dio.post<void>(
        '/matches/$matchId/read',
        data: {'up_to_message_id': messageId},
      );

  Future<void> unmatch(String matchId) =>
      _dio.delete<void>('/matches/$matchId');

  Future<void> block(String userId) =>
      _dio.post<void>('/safety/blocks', data: {'user_id': userId});

  Future<void> report({
    required String userId,
    required String matchId,
    required String reason,
    required String details,
  }) =>
      _dio.post<void>(
        '/safety/reports',
        data: {
          'reported_id': userId,
          'match_id': matchId,
          'reason': reason,
          'details': details,
        },
      );

  String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex =
        bytes.map((value) => value.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }
}
