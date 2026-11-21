import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/core/realtime/realtime_service.dart';

final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  final service = RealtimeService(
    ref.watch(tokenStorageProvider),
    ref.watch(dioProvider),
  );
  ref.onDispose(service.dispose);
  return service;
});

final realtimeEventsProvider = StreamProvider<RealtimeEvent>((ref) async* {
  final service = ref.watch(realtimeServiceProvider);
  await service.connect();
  yield* service.events;
});
