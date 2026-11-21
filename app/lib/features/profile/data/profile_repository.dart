import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/features/profile/domain/own_profile.dart';

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(dioProvider)),
);

final class ProfileRepository {
  const ProfileRepository(this._dio);
  final Dio _dio;
  Future<OwnProfile> get() async => OwnProfile.fromJson(
        (await _dio.get<Map<String, dynamic>>('/profiles/me')).data!,
      );
  Future<OwnProfile> update({
    required String bio,
    required String jobTitle,
    required String school,
    required String county,
    required List<String> languages,
  }) async =>
      OwnProfile.fromJson(
        (await _dio.patch<Map<String, dynamic>>(
          '/profiles/me',
          data: {
            'bio': bio,
            'job_title': jobTitle,
            'school': school,
            'county': county,
            'languages': languages,
          },
        ))
            .data!,
      );
  Future<Map<String, dynamic>> startVerification() async =>
      (await _dio.post<Map<String, dynamic>>('/safety/verification/start'))
          .data!;

  Future<bool> captureAndSubmitVerification(
    Map<String, dynamic> verification,
  ) async {
    final photo = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 90,
      preferredCameraDevice: CameraDevice.front,
    );
    if (photo == null) return false;
    final file = File(photo.path);
    await _dio.putUri<void>(
      Uri.parse(verification['upload_url'] as String),
      data: file.openRead(),
      options: Options(
        headers: {
          ...(verification['required_headers'] as Map<String, dynamic>),
        },
        contentType: 'image/jpeg',
      ),
    );
    await _dio.post<void>(
      '/safety/verification/submit',
      data: {
        'verification_id': verification['id'],
        'key': verification['key'],
      },
    );
    return true;
  }
}
