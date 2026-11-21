import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/features/likes/domain/received_like.dart';

final likesRepositoryProvider =
    Provider<LikesRepository>((ref) => LikesRepository(ref.watch(dioProvider)));

final class LikesRepository {
  const LikesRepository(this._dio);
  final Dio _dio;
  Future<ReceivedLikes> received() async => ReceivedLikes.fromJson(
        (await _dio.get<Map<String, dynamic>>('/likes/received')).data!,
      );
}
