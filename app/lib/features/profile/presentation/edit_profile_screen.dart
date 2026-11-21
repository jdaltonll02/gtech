import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/profile/application/profile_controller.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});
  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final bio = TextEditingController();
  final job = TextEditingController();
  final school = TextEditingController();
  final county = TextEditingController();
  final languages = TextEditingController();
  bool initialized = false;
  bool saving = false;
  @override
  void dispose() {
    bio.dispose();
    job.dispose();
    school.dispose();
    county.dispose();
    languages.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => saving = true);
    try {
      await ref.read(profileControllerProvider.notifier).saveProfile(
            bio: bio.text.trim(),
            jobTitle: job.text.trim(),
            school: school.text.trim(),
            county: county.text.trim(),
            languages: languages.text
                .split(',')
                .map((value) => value.trim())
                .where((value) => value.isNotEmpty)
                .toList(),
          );
      if (mounted) Navigator.pop(context);
    } on Object {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile changes could not be saved.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileControllerProvider);
    if (!initialized && state.hasValue) {
      final profile = state.requireValue;
      bio.text = profile.bio;
      job.text = profile.jobTitle;
      school.text = profile.school;
      county.text = profile.county;
      languages.text = profile.languages.join(', ');
      initialized = true;
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit profile'),
        actions: [
          TextButton(
            onPressed: saving ? null : _save,
            child: const Text('Save'),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                TextField(
                  controller: bio,
                  maxLength: 500,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'About me'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: job,
                  maxLength: 100,
                  decoration: const InputDecoration(labelText: 'Job title'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: school,
                  maxLength: 120,
                  decoration: const InputDecoration(labelText: 'School'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: county,
                  maxLength: 80,
                  decoration:
                      const InputDecoration(labelText: 'County or city'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: languages,
                  decoration: const InputDecoration(
                    labelText: 'Languages',
                    helperText: 'Separate languages with commas',
                  ),
                ),
                const SizedBox(height: 22),
                PepperButton(
                  label: saving ? 'Saving…' : 'Save profile',
                  onPressed: saving ? null : _save,
                ),
              ],
            ),
    );
  }
}
