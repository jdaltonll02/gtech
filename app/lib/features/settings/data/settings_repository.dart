import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/network/api_client.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>(
  (ref) => SettingsRepository(ref.watch(dioProvider)),
);

final class SettingsRepository {
  const SettingsRepository(this._dio);
  final Dio _dio;
  Future<Map<String, dynamic>> preferences() async =>
      (await _dio.get<Map<String, dynamic>>('/profiles/me/preferences')).data!;
  Future<void> updatePreferences(Map<String, dynamic> data) =>
      _dio.patch<void>('/profiles/me/preferences', data: data);
  Future<Map<String, dynamic>> notificationPreferences() async =>
      (await _dio.get<Map<String, dynamic>>('/notifications/preferences'))
          .data!;
  Future<void> updateNotifications(Map<String, dynamic> data) =>
      _dio.patch<void>('/notifications/preferences', data: data);
  Future<void> pause() => _dio.post<void>('/account/pause');
  Future<void> resume() => _dio.post<void>('/account/resume');
  Future<Map<String, dynamic>> export() async =>
      (await _dio.get<Map<String, dynamic>>('/account/export')).data!;
  Future<void> delete() =>
      _dio.delete<void>('/account', data: {'confirmation': 'DELETE'});
  Future<void> logout(String? refresh) =>
      _dio.post<void>('/auth/logout', data: {'refresh': refresh});
}
