import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/profile/application/profile_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(profileControllerProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            tooltip: 'Settings',
            onPressed: () => context.push('/profile/settings'),
            icon: const Icon(Icons.settings_outlined),
          ),
        ],
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => PepperErrorView(
          onRetry: () => ref.read(profileControllerProvider.notifier).reload(),
        ),
        data: (profile) => ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: Stack(
                children: [
                  PepperAvatar(label: profile.name, radius: 62),
                  if (profile.verified)
                    const Positioned(
                      right: 2,
                      bottom: 2,
                      child:
                          Icon(Icons.verified, color: Brand.red500, size: 30),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Text(
              profile.name,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
            if (profile.county.isNotEmpty)
              Text(profile.county, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            LinearProgressIndicator(value: profile.completeness / 100),
            const SizedBox(height: 6),
            Text(
              '${profile.completeness}% profile complete',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: PepperButton(
                    label: 'Edit profile',
                    onPressed: () => context.push('/profile/edit'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: PepperButton(
                    label: 'Preview',
                    outlined: true,
                    onPressed: () => _preview(
                      context,
                      profile.name,
                      profile.bio,
                      profile.jobTitle,
                      profile.school,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            ListTile(
              leading: const Icon(Icons.verified_user_outlined),
              title: const Text('Photo verification'),
              subtitle: Text(
                profile.verified
                    ? 'Verified'
                    : profile.verificationStatus == 'pending'
                        ? 'Review in progress'
                        : 'Help people know it is really you',
              ),
              trailing:
                  profile.verified ? null : const Icon(Icons.chevron_right),
              onTap: profile.verified
                  ? null
                  : () => context.push('/profile/verify'),
            ),
            ListTile(
              leading: const Icon(Icons.workspace_premium_outlined),
              title: const Text('Pepper upgrades'),
              subtitle: const Text('See plans and premium features'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/paywall'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _preview(
    BuildContext context,
    String name,
    String bio,
    String job,
    String school,
  ) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              PepperAvatar(label: name, radius: 54),
              const SizedBox(height: 12),
              Text(name, style: Theme.of(context).textTheme.headlineSmall),
              if (bio.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(bio),
                ),
              if (job.isNotEmpty || school.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    [job, school]
                        .where((value) => value.isNotEmpty)
                        .join(' · '),
                  ),
                ),
            ],
          ),
        ),
      );
}
