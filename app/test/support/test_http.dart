import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

typedef TestResponder = ResponseBody Function(RequestOptions request);

final class TestHttpAdapter implements HttpClientAdapter {
  TestHttpAdapter(this.respond);

  final TestResponder respond;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody jsonResponse(Object? body, {int status = 200}) =>
    ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
