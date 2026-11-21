import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pepper/core/network/api_client.dart';

final onboardingRepositoryProvider = Provider<OnboardingRepository>(
  (ref) => OnboardingRepository(ref.watch(dioProvider)),
);

final class OnboardingRepository {
  const OnboardingRepository(this._dio);
  final Dio _dio;
  Future<void> patchProfile(Map<String, Object?> values) =>
      _dio.patch<void>('/profiles/me', data: values);
  Future<void> updateShowMe(List<String> values) => _dio.patch<void>(
        '/profiles/me/preferences',
        data: {
          'show_me': values,
          'age_min': 18,
          'age_max': 50,
          'max_distance_km': 50,
          'counties_filter': <String>[],
          'global_mode': false,
          'is_discoverable': true,
        },
      );
  Future<List<Map<String, dynamic>>> interests() => _meta('/meta/interests');
  Future<List<Map<String, dynamic>>> counties() => _meta('/meta/counties');
  Future<List<Map<String, dynamic>>> _meta(String path) async {
    final response = await _dio.get<Map<String, dynamic>>(path);
    return (response.data!['results'] as List<dynamic>)
        .map((value) => value as Map<String, dynamic>)
        .toList();
  }

  Future<String?> pickAndUploadPhoto(
    int position,
    void Function(double) progress,
  ) async {
    final picked = await ImagePicker()
        .pickImage(source: ImageSource.gallery, imageQuality: 95);
    if (picked == null) return null;
    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      compressQuality: 92,
      uiSettings: [
        AndroidUiSettings(toolbarTitle: 'Crop profile photo'),
        IOSUiSettings(title: 'Crop profile photo'),
      ],
    );
    if (cropped == null) return null;
    final file = File(cropped.path);
    final length = await file.length();
    final signed = (await _dio.post<Map<String, dynamic>>(
      '/media/photos/upload-url',
      data: {'content_type': 'image/jpeg', 'content_length': length},
    ))
        .data!;
    await _dio.putUri<void>(
      Uri.parse(signed['upload_url'] as String),
      data: file.openRead(),
      options: Options(
        headers: {...(signed['required_headers'] as Map<String, dynamic>)},
        contentType: 'image/jpeg',
      ),
      onSendProgress: (sent, total) => progress(total == 0 ? 0 : sent / total),
    );
    final photo = (await _dio.post<Map<String, dynamic>>(
      '/media/photos',
      data: {'key': signed['key'], 'position': position},
    ))
        .data!;
    return photo['id'] as String;
  }

  Future<void> reorderPhotos(List<String> ids) =>
      _dio.patch<void>('/media/photos/reorder', data: {'photo_ids': ids});
  Future<void> updateLocation({
    required double latitude,
    required double longitude,
    required String source,
    double? accuracy,
  }) =>
      _dio.put<void>(
        '/profiles/me/location',
        data: {
          'latitude': latitude,
          'longitude': longitude,
          'source': source,
          if (accuracy != null) 'accuracy_m': accuracy,
        },
      );
  Future<void> complete() => _dio.post<void>('/profiles/me/complete');
}
