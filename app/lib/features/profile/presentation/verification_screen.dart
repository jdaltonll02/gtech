import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/profile/application/profile_controller.dart';
import 'package:pepper/features/profile/data/profile_repository.dart';

class VerificationScreen extends ConsumerStatefulWidget {
  const VerificationScreen({super.key});
  @override
  ConsumerState<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends ConsumerState<VerificationScreen> {
  Map<String, dynamic>? verification;
  bool busy = false;

  Future<void> _start() async {
    setState(() => busy = true);
    try {
      verification =
          await ref.read(profileRepositoryProvider).startVerification();
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not start verification.')),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _capture() async {
    final current = verification;
    if (current == null) return;
    setState(() => busy = true);
    try {
      final submitted = await ref
          .read(profileRepositoryProvider)
          .captureAndSubmitVerification(current);
      if (submitted && mounted) {
        ref.invalidate(profileControllerProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Selfie submitted for review.')),
        );
        Navigator.pop(context);
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Verification selfie could not be submitted.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Photo verification')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.verified_user_outlined,
                size: 76,
                color: Brand.red500,
              ),
              const SizedBox(height: 20),
              Text(
                verification == null
                    ? 'Show that you are really you'
                    : 'Your pose',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                verification == null
                    ? 'We compare one private selfie with your profile photos. The selfie is never shown on your profile.'
                    : verification!['pose_code'] as String,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              PepperButton(
                label: busy
                    ? 'Please wait…'
                    : verification == null
                        ? 'Get my pose'
                        : 'Open camera',
                onPressed: busy
                    ? null
                    : verification == null
                        ? _start
                        : _capture,
              ),
            ],
          ),
        ),
      );
}
