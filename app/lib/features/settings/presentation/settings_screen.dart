import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/network/api_client.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/settings/data/settings_repository.dart';

final settingsDataProvider = FutureProvider((ref) async {
  final repository = ref.watch(settingsRepositoryProvider);
  final values = await Future.wait(
    [repository.preferences(), repository.notificationPreferences()],
  );
  return (discovery: values[0], notifications: values[1]);
});

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(settingsDataProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: data.when(
        loading: () => const Center(
          child: PepperProgressIndicator(label: 'Loading settings'),
        ),
        error: (_, __) => PepperErrorView(
          onRetry: () => ref.invalidate(settingsDataProvider),
        ),
        data: (values) => _SettingsBody(
          discovery: values.discovery,
          notifications: values.notifications,
        ),
      ),
    );
  }
}

class _SettingsBody extends ConsumerStatefulWidget {
  const _SettingsBody({required this.discovery, required this.notifications});
  final Map<String, dynamic> discovery;
  final Map<String, dynamic> notifications;
  @override
  ConsumerState<_SettingsBody> createState() => _SettingsBodyState();
}

class _SettingsBodyState extends ConsumerState<_SettingsBody> {
  late double distance =
      (widget.discovery['max_distance_km'] as num? ?? 50).toDouble();
  late RangeValues ages = RangeValues(
    (widget.discovery['age_min'] as num? ?? 18).toDouble(),
    (widget.discovery['age_max'] as num? ?? 50).toDouble(),
  );
  late bool global = widget.discovery['global_mode'] as bool? ?? false;
  late bool discoverable = widget.discovery['is_discoverable'] as bool? ?? true;
  late bool newMatches = widget.notifications['new_matches'] as bool? ?? true;
  late bool messages = widget.notifications['messages'] as bool? ?? true;
  late bool likes = widget.notifications['likes'] as bool? ?? true;
  late bool promotions = widget.notifications['promotions'] as bool? ?? false;
  late bool previews =
      widget.notifications['message_previews'] as bool? ?? true;
  bool saving = false;

  Future<void> _save() async {
    setState(() => saving = true);
    try {
      final repository = ref.read(settingsRepositoryProvider);
      await Future.wait([
        repository.updatePreferences({
          'show_me':
              widget.discovery['show_me'] ?? ['woman', 'man', 'nonbinary'],
          'age_min': ages.start.round(),
          'age_max': ages.end.round(),
          'max_distance_km': distance.round(),
          'counties_filter': widget.discovery['counties_filter'] ?? <String>[],
          'global_mode': global,
          'is_discoverable': discoverable,
        }),
        repository.updateNotifications({
          'new_matches': newMatches,
          'messages': messages,
          'likes': likes,
          'promotions': promotions,
          'message_previews': previews,
        }),
      ]);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Settings saved.')));
      }
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Settings could not be saved.')),
        );
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _logout() async {
    final storage = ref.read(tokenStorageProvider);
    final refresh = await storage.readRefreshToken();
    await ref
        .read(settingsRepositoryProvider)
        .logout(refresh)
        .catchError((_) {});
    await storage.clear();
    if (mounted) context.go('/auth/phone');
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Discovery', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Text('Distance: ${distance.round()} km'),
          Slider(
            value: distance,
            min: 2,
            max: 160,
            divisions: 158,
            label: '${distance.round()} km',
            onChanged: (value) => setState(() => distance = value),
          ),
          Text('Ages: ${ages.start.round()}–${ages.end.round()}'),
          RangeSlider(
            values: ages,
            min: 18,
            max: 100,
            divisions: 82,
            labels: RangeLabels('${ages.start.round()}', '${ages.end.round()}'),
            onChanged: (value) => setState(() => ages = value),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Global mode'),
            subtitle:
                const Text('Include people beyond your selected distance'),
            value: global,
            onChanged: (value) => setState(() => global = value),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Show me in discovery'),
            value: discoverable,
            onChanged: (value) => setState(() => discoverable = value),
          ),
          const Divider(height: 36),
          Text('Notifications', style: Theme.of(context).textTheme.titleLarge),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('New connections'),
            value: newMatches,
            onChanged: (value) => setState(() => newMatches = value),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Messages'),
            value: messages,
            onChanged: (value) => setState(() => messages = value),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Likes'),
            value: likes,
            onChanged: (value) => setState(() => likes = value),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Promotions'),
            value: promotions,
            onChanged: (value) => setState(() => promotions = value),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Message previews'),
            value: previews,
            onChanged: (value) => setState(() => previews = value),
          ),
          const SizedBox(height: 14),
          PepperButton(
            label: saving ? 'Saving…' : 'Save settings',
            onPressed: saving ? null : _save,
          ),
          const Divider(height: 36),
          Text(
            'Privacy and account',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.pause_circle_outline),
            title: const Text('Pause account'),
            subtitle: const Text('Hide your profile without deleting it'),
            onTap: _pause,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.download_outlined),
            title: const Text('Export my data'),
            onTap: _exportData,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.delete_outline),
            title: const Text('Delete account'),
            onTap: _confirmDelete,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.logout),
            title: const Text('Log out'),
            onTap: _logout,
          ),
          const Divider(height: 36),
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.description_outlined),
            title: Text('Terms of service'),
          ),
          const ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.privacy_tip_outlined),
            title: Text('Privacy policy'),
          ),
        ],
      );

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete your account?'),
            content: const Text(
              'Your profile will disappear immediately. Permanent deletion is scheduled after the recovery period.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete account'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    await ref.read(settingsRepositoryProvider).delete();
    await ref.read(tokenStorageProvider).clear();
    if (mounted) context.go('/auth/phone');
  }

  Future<void> _pause() async {
    await ref.read(settingsRepositoryProvider).pause();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Account paused. You can resume it here later.'),
      ),
    );
  }

  Future<void> _exportData() async {
    await ref.read(settingsRepositoryProvider).export();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Your secure export is being prepared.')),
    );
  }
}
