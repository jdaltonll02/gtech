import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/likes/application/likes_controller.dart';

class LikesScreen extends ConsumerWidget {
  const LikesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(likesControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Likes You')),
      body: state.when(
        loading: () => const Center(
          child: PepperProgressIndicator(label: 'Loading likes'),
        ),
        error: (_, __) => PepperErrorView(
          onRetry: () => ref.read(likesControllerProvider.notifier).reload(),
        ),
        data: (data) {
          if (data.count == 0) {
            return const PepperEmptyState(
              icon: Icons.favorite_border,
              title: 'No likes yet',
              body: 'When someone likes you, they will appear here.',
            );
          }
          if (data.locked) return _LockedLikes(count: data.count);
          return RefreshIndicator(
            onRefresh: ref.read(likesControllerProvider.notifier).reload,
            child: GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: .72,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: data.likes.length,
              itemBuilder: (_, index) {
                final like = data.likes[index];
                return ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (like.photoUrl case final url?)
                        PepperImage(
                          url: url,
                          semanticLabel: '${like.name} profile photo',
                        )
                      else
                        const ColoredBox(
                          color: Brand.ink800,
                          child: Icon(
                            Icons.person,
                            color: Brand.grey400,
                            size: 64,
                          ),
                        ),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.center,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, Brand.black],
                          ),
                        ),
                      ),
                      Positioned(
                        left: 12,
                        right: 12,
                        bottom: 12,
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                '${like.name}, ${like.age}',
                                style: const TextStyle(
                                  color: Brand.white,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            if (like.verified)
                              const Padding(
                                padding: EdgeInsets.only(left: 4),
                                child: Icon(
                                  Icons.verified,
                                  size: 17,
                                  color: Brand.white,
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (like.superlike)
                        const Positioned(
                          top: 10,
                          right: 10,
                          child: PepperBadge(label: 'Super Like'),
                        ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _LockedLikes extends StatelessWidget {
  const _LockedLikes({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                const Icon(Icons.favorite, color: Brand.red500, size: 110),
                Text(
                  '$count',
                  style: const TextStyle(
                    color: Brand.white,
                    fontSize: 30,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              '$count ${count == 1 ? 'person likes' : 'people like'} you',
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Upgrade to see everyone who already noticed you.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            PepperButton(
              label: 'See upgrade options',
              onPressed: () => context.push('/paywall'),
            ),
          ],
        ),
      );
}
