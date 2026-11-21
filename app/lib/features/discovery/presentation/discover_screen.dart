import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/network/app_exception.dart';
import 'package:pepper/core/widgets/pepper_widgets.dart';
import 'package:pepper/features/discovery/application/discovery_controller.dart';
import 'package:pepper/features/discovery/domain/discovery_card.dart';
import 'package:pepper/features/discovery/presentation/swipe_deck.dart';

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _deckController = SwipeDeckController();
  bool _busy = false;

  @override
  void dispose() {
    _deckController.dispose();
    super.dispose();
  }

  String _message(Object error) {
    if (error case DioException(error: final AppException exception)) {
      return exception.message;
    }
    return 'Something went wrong. Please try again.';
  }

  Future<void> _swipe(DiscoveryCardModel card, SwipeAction action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(discoveryControllerProvider.notifier)
          .swipe(card, action);
      if (result['matched'] == true && mounted) {
        await showDialog<void>(
          context: context,
          builder: (_) => _MatchDialog(card: card),
        );
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_message(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _rewind() async {
    try {
      await ref.read(discoveryControllerProvider.notifier).rewind();
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_message(error))),
        );
      }
    }
  }

  Future<void> _boost() async {
    try {
      final result =
          await ref.read(discoveryControllerProvider.notifier).activateBoost();
      if (mounted) {
        final end = result['ends_at'] as String?;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              end == null
                  ? 'Your profile boost is active.'
                  : 'Your profile boost is active for 30 minutes.',
            ),
          ),
        );
      }
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_message(error))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final deck = ref.watch(discoveryControllerProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          Brand.appName,
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            tooltip: 'Discovery settings',
            onPressed: () => context.push('/profile/settings'),
            icon: const Icon(Icons.tune),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: deck.when(
          loading: () => const Center(
            child: PepperProgressIndicator(label: 'Loading profiles'),
          ),
          error: (_, __) => PepperErrorView(
            onRetry: () =>
                ref.read(discoveryControllerProvider.notifier).reload(),
          ),
          data: (cards) => cards.isEmpty
              ? PepperEmptyState(
                  icon: Icons.travel_explore,
                  title: 'You are all caught up',
                  body:
                      'Try widening your preferences or come back a little later.',
                  action: PepperButton(
                    label: 'Check again',
                    onPressed: () =>
                        ref.read(discoveryControllerProvider.notifier).reload(),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: SwipeDeck(
                          cards: cards,
                          controller: _deckController,
                          cardBuilder: (_, card) => _ProfileCard(card: card),
                          onSwipe: _swipe,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          CircularActionButton(
                            icon: Icons.replay,
                            label: 'Rewind last profile',
                            onPressed: _rewind,
                          ),
                          CircularActionButton(
                            icon: Icons.close,
                            label: 'Pass',
                            onPressed: () =>
                                _deckController.swipe(SwipeAction.nope),
                          ),
                          CircularActionButton(
                            icon: Icons.star,
                            label: 'Super Like',
                            onPressed: () =>
                                _deckController.swipe(SwipeAction.superlike),
                          ),
                          CircularActionButton(
                            icon: Icons.favorite,
                            label: 'Like',
                            emphasized: true,
                            onPressed: () =>
                                _deckController.swipe(SwipeAction.like),
                          ),
                          CircularActionButton(
                            icon: Icons.bolt,
                            label: 'Boost profile',
                            onPressed: _boost,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

class _ProfileCard extends StatefulWidget {
  const _ProfileCard({required this.card});
  final DiscoveryCardModel card;

  @override
  State<_ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends State<_ProfileCard> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    return ClipRRect(
      borderRadius: BorderRadius.circular(22),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (card.photos.isEmpty)
            const ColoredBox(
              color: Brand.ink800,
              child: Icon(Icons.person, size: 96, color: Brand.grey400),
            )
          else
            PageView.builder(
              itemCount: card.photos.length,
              onPageChanged: (value) => setState(() => _page = value),
              itemBuilder: (_, index) => PepperImage(
                url: card.photos[index].large,
                semanticLabel:
                    '${card.name} photo ${index + 1} of ${card.photos.length}',
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
          if (card.photos.length > 1)
            Positioned(
              top: 10,
              left: 10,
              right: 10,
              child: Row(
                children: List.generate(
                  card.photos.length,
                  (index) => Expanded(
                    child: Container(
                      height: 3,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: index == _page ? Brand.white : Brand.grey400,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            left: 20,
            right: 20,
            bottom: 18,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        '${card.name}, ${card.age}',
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  color: Brand.white,
                                  fontWeight: FontWeight.w800,
                                ),
                      ),
                    ),
                    if (card.verified) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.verified, color: Brand.white, size: 21),
                    ],
                  ],
                ),
                const SizedBox(height: 5),
                Text(
                  [card.jobTitle, card.school]
                      .where((value) => value.isNotEmpty)
                      .join(' · '),
                  style: const TextStyle(color: Brand.white),
                ),
                Text(
                  '${card.distanceLabel}${card.county.isEmpty ? '' : ' · ${card.county}'}',
                  style: const TextStyle(color: Brand.white),
                ),
                if (card.bio.isNotEmpty) ...[
                  const SizedBox(height: 7),
                  Text(
                    card.bio,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Brand.white),
                  ),
                ],
                if (card.superlikedYou) ...[
                  const SizedBox(height: 8),
                  const PepperBadge(label: 'Super Liked you'),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MatchDialog extends StatelessWidget {
  const _MatchDialog({required this.card});
  final DiscoveryCardModel card;

  @override
  Widget build(BuildContext context) => AlertDialog(
        icon: const Icon(Icons.favorite, color: Brand.red500, size: 52),
        title: const Text('You found a spark'),
        content: Text(
          'You and ${card.name} like each other. Start with something genuine.',
          textAlign: TextAlign.center,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Keep discovering'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Say hello'),
          ),
        ],
      );
}
