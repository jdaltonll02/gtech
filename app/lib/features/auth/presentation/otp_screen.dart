import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/auth/application/auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({required this.challengeId, required this.phone, super.key});
  final String challengeId;
  final String phone;
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  late final controllers = List.generate(6, (_) => TextEditingController());
  late final nodes = List.generate(6, (_) => FocusNode());
  Timer? timer;
  int remaining = 30;
  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && remaining > 0) setState(() => remaining -= 1);
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    for (final value in controllers) {
      value.dispose();
    }
    for (final value in nodes) {
      value.dispose();
    }
    super.dispose();
  }

  Future<void> verify() async {
    final code = controllers.map((value) => value.text).join();
    if (code.length != 6) return;
    final result = await ref
        .read(authControllerProvider.notifier)
        .verifyOtp(widget.challengeId, code);
    if (result != null && mounted) {
      context.go(result.isNewUser ? '/onboarding/name' : '/discover');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(
        leading: BackButton(onPressed: () => context.go('/auth/phone')),
      ),
      body: SafeArea(
        minimum: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 36),
            const Text(
              'Enter your code',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text('We sent six digits to +231 ${widget.phone}'),
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(
                6,
                (index) => SizedBox(
                  width: 46,
                  child: TextField(
                    key: ValueKey('otp-$index'),
                    controller: controllers[index],
                    focusNode: nodes[index],
                    autofocus: index == 0,
                    textAlign: TextAlign.center,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                    ],
                    maxLength: 1,
                    decoration: const InputDecoration(counterText: ''),
                    onChanged: (value) {
                      if (value.isNotEmpty && index < 5) {
                        nodes[index + 1].requestFocus();
                      }
                      if (value.isEmpty && index > 0) {
                        nodes[index - 1].requestFocus();
                      }
                      if (index == 5 && value.isNotEmpty) {
                        verify();
                      }
                    },
                  ),
                ),
              ),
            ),
            if (state.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  'That code is incorrect or expired.',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            const SizedBox(height: 24),
            PepperButton(
              label: state.isLoading ? 'Checking…' : 'Verify',
              onPressed: state.isLoading ? null : verify,
            ),
            TextButton(
              onPressed:
                  remaining == 0 ? () => context.go('/auth/phone') : null,
              child: Text(
                remaining == 0 ? 'Resend code' : 'Resend in ${remaining}s',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
