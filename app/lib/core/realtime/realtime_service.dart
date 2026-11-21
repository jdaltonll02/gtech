import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:pepper/core/config/environment.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

final class RealtimeEvent {
  const RealtimeEvent({
    required this.type,
    required this.data,
    required this.timestamp,
  });
  factory RealtimeEvent.fromJson(Map<String, dynamic> json) => RealtimeEvent(
        type: json['type'] as String,
        data: json['data'],
        timestamp: DateTime.parse(json['ts'] as String),
      );
  final String type;
  final Object? data;
  final DateTime timestamp;
}

final class RealtimeService {
  RealtimeService(this._storage, this._dio);
  final TokenStorage _storage;
  final Dio _dio;
  final _events = StreamController<RealtimeEvent>.broadcast();
  final _random = Random();
  WebSocketChannel? _channel;
  Timer? _heartbeat;
  Timer? _reconnect;
  DateTime _lastSync = DateTime.now().toUtc();
  var _attempt = 0;
  var _disposed = false;
  Stream<RealtimeEvent> get events => _events.stream;

  Future<void> connect() async {
    if (_disposed || _channel != null) return;
    final token = await _storage.readAccessToken();
    if (token == null) return;
    final base = Uri.parse(Environment.apiBaseUrl);
    final uri = base.replace(
      scheme: base.scheme == 'https' ? 'wss' : 'ws',
      path: '/ws/',
      queryParameters: {
        'token': token,
        'EIO': '4',
        'transport': 'websocket',
      },
    );
    try {
      final channel = WebSocketChannel.connect(uri);
      await channel.ready;
      if (_disposed) {
        await channel.sink.close();
        return;
      }
      _channel = channel;
      channel.stream.listen(
        _receive,
        onDone: _connectionEnded,
        onError: (_) => _connectionEnded(),
      );
    } on Object {
      _channel = null;
      _scheduleReconnect();
    }
  }

  void _receive(Object? raw) {
    if (raw is! String) return;
    if (raw.startsWith('0')) {
      _channel?.sink.add('40');
      return;
    }
    if (raw == '2') {
      _channel?.sink.add('3');
      return;
    }
    if (raw.startsWith('40')) {
      _attempt = 0;
      _heartbeat?.cancel();
      _heartbeat = Timer.periodic(
        const Duration(seconds: 25),
        (_) => _channel?.sink.add('42["ping",{}]'),
      );
      unawaited(_resync().catchError((Object _) => _closeForReconnect()));
      return;
    }
    if (!raw.startsWith('42')) return;
    try {
      final decoded = jsonDecode(raw.substring(2));
      if (decoded is! List<Object?> ||
          decoded.length < 2 ||
          decoded[1] is! Map<String, dynamic>) {
        return;
      }
      final event = RealtimeEvent.fromJson(
        decoded[1]! as Map<String, dynamic>,
      );
      _lastSync = event.timestamp;
      _events.add(event);
    } on FormatException {
      // Ignore malformed frames and keep the authenticated session alive.
    }
  }

  void send(String type, Map<String, Object?> data) =>
      _send({'type': type, 'data': data});
  void _send(Map<String, Object?> value) =>
      _channel?.sink.add('42["event",${jsonEncode(value)}]');
  Future<void> _resync() async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/sync',
      queryParameters: {'since': _lastSync.toIso8601String()},
    );
    _events.add(
      RealtimeEvent(
        type: 'sync.completed',
        data: response.data,
        timestamp: DateTime.now().toUtc(),
      ),
    );
  }

  void _connectionEnded() {
    _channel = null;
    _scheduleReconnect();
  }

  void _closeForReconnect() {
    final channel = _channel;
    _channel = null;
    unawaited(channel?.sink.close());
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    _heartbeat?.cancel();
    if (_disposed || (_reconnect?.isActive ?? false)) return;
    final seconds = min(30, pow(2, _attempt).toInt()) + _random.nextDouble();
    _attempt += 1;
    _reconnect = Timer(
      Duration(milliseconds: (seconds * 1000).round()),
      () => unawaited(connect()),
    );
  }

  Future<void> dispose() async {
    _disposed = true;
    _heartbeat?.cancel();
    _reconnect?.cancel();
    await _channel?.sink.close();
    await _events.close();
  }
}
