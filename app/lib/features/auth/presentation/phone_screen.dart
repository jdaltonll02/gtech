import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/config/environment.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/auth/application/auth_controller.dart';

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key});
  @override
  ConsumerState<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends ConsumerState<PhoneScreen> {
  final controller = TextEditingController();
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final digits = controller.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 7) return;
    final challenge = await ref
        .read(authControllerProvider.notifier)
        .requestOtp('+231$digits');
    if (challenge != null && mounted) {
      context.go(
        '/auth/otp',
        extra: {'challenge_id': challenge.id, 'phone': digits},
      );
    }
  }

  Future<void> social(String provider) async {
    final result =
        await ref.read(authControllerProvider.notifier).social(provider);
    if (result == null || !mounted) return;
    context.go(result.isNewUser ? '/onboarding/name' : '/discover');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(authControllerProvider);
    return Scaffold(
      body: SafeArea(
        minimum: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Spacer(),
            const Text(
              Brand.appName,
              style: TextStyle(fontSize: 44, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            Text(
              'Meet people who feel like home.',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 40),
            TextField(
              controller: controller,
              keyboardType: TextInputType.phone,
              autofillHints: const [
                AutofillHints.telephoneNumberNational,
              ],
              decoration: const InputDecoration(
                prefixText: '🇱🇷  +231  ',
                labelText: 'Phone number',
              ),
            ),
            if (state.hasError)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'Enter a valid Liberian mobile number.',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ),
            const SizedBox(height: 16),
            PepperButton(
              label: state.isLoading ? 'Sending…' : 'Continue',
              onPressed: state.isLoading ? null : submit,
            ),
            if (Environment.googleClientId.isNotEmpty ||
                Environment.appleClientId.isNotEmpty) ...[
              const SizedBox(height: 18),
              if (Environment.googleClientId.isNotEmpty)
                PepperButton(
                  label: 'Continue with Google',
                  outlined: true,
                  onPressed: () => social('google'),
                ),
              if (Environment.appleClientId.isNotEmpty)
                PepperButton(
                  label: 'Continue with Apple',
                  outlined: true,
                  onPressed: () => social('apple'),
                ),
            ],
            const Spacer(flex: 2),
          ],
        ),
      ),
    );
  }
}
