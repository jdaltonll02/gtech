import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/onboarding/application/onboarding_controller.dart';
import 'package:pepper/features/onboarding/data/onboarding_repository.dart';
import 'package:pepper/features/onboarding/domain/onboarding_step.dart';
import 'package:permission_handler/permission_handler.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({required this.step, super.key});
  final OnboardingStep step;
  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final text = TextEditingController();
  final selectedMany = <String>{};
  final photos = <String>[];
  DateTime? birthday;
  String? selected;
  double uploadProgress = 0;
  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  void advance() {
    final next = widget.step.next;
    context.go(next == null ? '/discover' : '/onboarding/${next.path}');
  }

  Future<void> save(
    Future<void> Function(OnboardingRepository) operation,
  ) async {
    final success =
        await ref.read(onboardingControllerProvider.notifier).run(operation);
    if (success && mounted) advance();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: LinearProgressIndicator(
            value: (OnboardingStep.values.indexOf(widget.step) + 1) /
                OnboardingStep.values.length,
          ),
          actions: [
            if (widget.step == OnboardingStep.notifications)
              TextButton(
                onPressed: () => save((repo) => repo.complete()),
                child: const Text('Skip'),
              ),
          ],
        ),
        body: SafeArea(
          minimum: const EdgeInsets.all(24),
          child: SingleChildScrollView(child: content()),
        ),
      );
  Widget frame(
    String title,
    String subtitle,
    Widget child, {
    VoidCallback? onContinue,
    String label = 'Continue',
  }) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(subtitle),
          const SizedBox(height: 28),
          child,
          const SizedBox(height: 28),
          PepperButton(label: label, onPressed: onContinue),
        ],
      );
  Widget content() {
    final loading = ref.watch(onboardingControllerProvider).isLoading;
    switch (widget.step) {
      case OnboardingStep.name:
        return frame(
          "What's your first name?",
          'This is how people will see you.',
          TextField(
            controller: text,
            maxLength: 80,
            textCapitalization: TextCapitalization.words,
            autofocus: true,
            onChanged: (_) => setState(() {}),
          ),
          onContinue: loading || text.text.trim().isEmpty
              ? null
              : () => save(
                    (repo) =>
                        repo.patchProfile({'display_name': text.text.trim()}),
                  ),
        );
      case OnboardingStep.birthday:
        return frame(
          "When's your birthday?",
          'You must be 18 or older. This cannot be changed later.',
          ListTile(
            title: Text(
              birthday == null
                  ? 'Choose your birthday'
                  : DateFormat.yMMMMd().format(birthday!),
            ),
            trailing: const Icon(Icons.calendar_month),
            onTap: chooseBirthday,
          ),
          onContinue: birthday == null
              ? null
              : () => save(
                    (repo) => repo.patchProfile({
                      'birth_date': DateFormat('yyyy-MM-dd').format(birthday!),
                    }),
                  ),
        );
      case OnboardingStep.gender:
        return choicePage(
          'How do you identify?',
          'Choose the option that feels right.',
          const {'woman': 'Woman', 'man': 'Man', 'nonbinary': 'Nonbinary'},
          (repo) => repo.patchProfile({'gender': selected}),
        );
      case OnboardingStep.showMe:
        return choicePage(
          'Who would you like to meet?',
          'Choose one or more.',
          const {
            'woman': 'Women',
            'man': 'Men',
            'nonbinary': 'Nonbinary people',
          },
          (repo) => repo.updateShowMe(selectedMany.toList()),
          multiple: true,
        );
      case OnboardingStep.goal:
        return choicePage(
          'What are you looking for?',
          'You can change this any time.',
          const {
            'long_term': 'A long-term relationship',
            'long_term_open': 'Long-term, open to short',
            'short_term_open': 'Short-term, open to long',
            'short_term': 'Something casual',
            'friends': 'New friends',
            'figuring_out': 'Still figuring it out',
          },
          (repo) => repo.patchProfile({'relationship_goal': selected}),
        );
      case OnboardingStep.photos:
        return photoPage();
      case OnboardingStep.interests:
        return metadataPage();
      case OnboardingStep.languages:
        return choicePage(
          'Which languages do you speak?',
          'Choose all that apply.',
          const {
            'English': 'English',
            'Liberian English': 'Liberian English',
            'Kpelle': 'Kpelle',
            'Bassa': 'Bassa',
            'Grebo': 'Grebo',
            'Dan': 'Dan',
            'Kru': 'Kru',
            'Mano': 'Mano',
            'Loma': 'Loma',
            'Kissi': 'Kissi',
            'Gola': 'Gola',
            'Vai': 'Vai',
            'Krahn': 'Krahn',
            'Mandingo': 'Mandingo',
            'Mende': 'Mende',
          },
          (repo) => repo.patchProfile({'languages': selectedMany.toList()}),
          multiple: true,
        );
      case OnboardingStep.location:
        return locationPage();
      case OnboardingStep.notifications:
        return frame(
          'Stay in the loop',
          'Choose whether Pepper can notify you about matches and messages.',
          const Icon(Icons.notifications_active_outlined, size: 96),
          label: 'Enable notifications',
          onContinue: () async {
            await Permission.notification.request();
            await save((repo) => repo.complete());
          },
        );
    }
  }

  Future<void> chooseBirthday() async {
    final now = DateTime.now();
    final value = await showDatePicker(
      context: context,
      firstDate: DateTime(now.year - 100),
      lastDate: DateTime(now.year - 18),
      initialDate: DateTime(now.year - 25),
    );
    if (value != null) setState(() => birthday = value);
  }

  Widget choicePage(
    String title,
    String subtitle,
    Map<String, String> values,
    Future<void> Function(OnboardingRepository) operation, {
    bool multiple = false,
  }) {
    final chips = values.entries
        .map(
          (entry) => FilterChip(
            label: Text(entry.value),
            selected: multiple
                ? selectedMany.contains(entry.key)
                : selected == entry.key,
            onSelected: (enabled) => setState(() {
              if (multiple) {
                if (enabled) {
                  selectedMany.add(entry.key);
                } else {
                  selectedMany.remove(entry.key);
                }
              } else {
                selected = enabled ? entry.key : null;
              }
            }),
          ),
        )
        .toList();
    return frame(
      title,
      subtitle,
      Wrap(spacing: 10, runSpacing: 10, children: chips),
      onContinue: (multiple ? selectedMany.isEmpty : selected == null)
          ? null
          : () => save(operation),
    );
  }

  Widget photoPage() => frame(
        'Add your best photos',
        'Add at least 2 and up to 9. You can reorder them.',
        Column(
          children: [
            ReorderableListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: photos.length,
              itemBuilder: (context, index) => ListTile(
                key: ValueKey(photos[index]),
                leading: CircleAvatar(child: Text('${index + 1}')),
                title: const Text('Photo uploaded'),
                trailing: const Icon(Icons.drag_handle),
              ),
              onReorder: (oldIndex, newIndex) {
                setState(() {
                  if (newIndex > oldIndex) newIndex -= 1;
                  photos.insert(newIndex, photos.removeAt(oldIndex));
                });
                ref.read(onboardingRepositoryProvider).reorderPhotos(photos);
              },
            ),
            if (uploadProgress > 0 && uploadProgress < 1)
              LinearProgressIndicator(value: uploadProgress),
            OutlinedButton.icon(
              onPressed: photos.length >= 9 ? null : addPhoto,
              icon: const Icon(Icons.add_a_photo),
              label: const Text('Add photo'),
            ),
          ],
        ),
        onContinue: photos.length < 2 ? null : advance,
      );
  Future<void> addPhoto() async {
    final id = await ref.read(onboardingRepositoryProvider).pickAndUploadPhoto(
          photos.length,
          (value) => setState(() => uploadProgress = value),
        );
    if (id != null) setState(() => photos.add(id));
  }

  Widget metadataPage() => FutureBuilder<List<Map<String, dynamic>>>(
        future: ref.read(onboardingRepositoryProvider).interests(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final chips = snapshot.data!.map((item) {
            final id = item['id'] as String;
            return FilterChip(
              label: Text(item['label'] as String),
              selected: selectedMany.contains(id),
              onSelected: (enabled) => setState(() {
                if (enabled && selectedMany.length < 5) {
                  selectedMany.add(id);
                } else if (!enabled) {
                  selectedMany.remove(id);
                }
              }),
            );
          }).toList();
          return frame(
            'What are you into?',
            'Choose up to 5.',
            Wrap(spacing: 8, runSpacing: 8, children: chips),
            onContinue: selectedMany.isEmpty
                ? null
                : () => save(
                      (repo) => repo.patchProfile(
                        {'interest_ids': selectedMany.toList()},
                      ),
                    ),
          );
        },
      );
  Widget locationPage() => FutureBuilder<List<Map<String, dynamic>>>(
        future: ref.read(onboardingRepositoryProvider).counties(),
        builder: (context, snapshot) => frame(
          'Where are you?',
          'Your exact location is never shown to anyone.',
          Column(
            children: [
              PepperButton(
                label: 'Use my current location',
                onPressed: useLocation,
              ),
              if (snapshot.hasData) ...[
                const SizedBox(height: 20),
                const Text('Or choose your county'),
                DropdownButtonFormField<Map<String, dynamic>>(
                  items: snapshot.data!
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text(item['label'] as String),
                        ),
                      )
                      .toList(),
                  onChanged: useCounty,
                ),
              ],
            ],
          ),
        ),
      );
  Future<void> useLocation() async {
    final permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return;
    }
    final position = await Geolocator.getCurrentPosition();
    await save(
      (repo) => repo.updateLocation(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        source: 'gps',
      ),
    );
  }

  void useCounty(Map<String, dynamic>? item) {
    if (item == null) return;
    save(
      (repo) => repo.updateLocation(
        latitude: (item['latitude'] as num).toDouble(),
        longitude: (item['longitude'] as num).toDouble(),
        source: 'manual_county',
      ),
    );
  }
}
