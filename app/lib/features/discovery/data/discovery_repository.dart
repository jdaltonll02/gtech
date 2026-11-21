import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/features/discovery/domain/discovery_card.dart';

final discoveryRepositoryProvider = Provider<DiscoveryRepository>(
  (ref) => DiscoveryRepository(ref.watch(dioProvider)),
);

final class DiscoveryRepository {
  const DiscoveryRepository(this._dio);
  final Dio _dio;

  Future<List<DiscoveryCardModel>> deck() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/discovery/deck',
      queryParameters: {'limit': 20},
    );
    return (response.data!['results'] as List<dynamic>)
        .map(
          (value) => DiscoveryCardModel.fromJson(value as Map<String, dynamic>),
        )
        .toList();
  }

  Future<Map<String, dynamic>> swipe(String id, SwipeAction action) async =>
      (await _dio.post<Map<String, dynamic>>(
        '/swipes',
        data: {
          'target_id': id,
          'action': action.name,
          'client_ts': DateTime.now().toUtc().toIso8601String(),
        },
      ))
          .data!;
  Future<void> rewind() => _dio.post<void>('/swipes/rewind');
  Future<Map<String, dynamic>> activateBoost() async =>
      (await _dio.post<Map<String, dynamic>>('/billing/boost/activate')).data!;
}
