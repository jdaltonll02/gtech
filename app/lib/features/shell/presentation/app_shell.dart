import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/core/realtime/realtime_provider.dart';
import 'package:pepper/core/realtime/realtime_service.dart';
import 'package:pepper/features/billing/presentation/paywall_screen.dart';
import 'package:pepper/features/chat/application/chat_controllers.dart';
import 'package:pepper/features/discovery/application/discovery_controller.dart';
import 'package:pepper/features/likes/application/likes_controller.dart';
import 'package:pepper/features/profile/application/profile_controller.dart';

class AppShell extends ConsumerWidget {
  const AppShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  static const destinations = [
    NavigationDestination(
      icon: Icon(Icons.style_outlined),
      selectedIcon: Icon(Icons.style),
      label: 'Discover',
    ),
    NavigationDestination(
      icon: Icon(Icons.grid_view_outlined),
      selectedIcon: Icon(Icons.grid_view),
      label: 'Explore',
    ),
    NavigationDestination(
      icon: Icon(Icons.favorite_border),
      selectedIcon: Icon(Icons.favorite),
      label: 'Likes',
    ),
    NavigationDestination(
      icon: Icon(Icons.chat_bubble_outline),
      selectedIcon: Icon(Icons.chat_bubble),
      label: 'Chats',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: 'Profile',
    ),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(realtimeEventsProvider, (_, next) {
      next.whenData((event) => applyRealtimeEvent(ref, event));
    });
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        indicatorColor: Brand.red500.withValues(alpha: .14),
        destinations: destinations,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
      ),
    );
  }
}

@visibleForTesting
void applyRealtimeEvent(WidgetRef ref, RealtimeEvent event) {
  switch (event.type) {
    case 'message.new':
    case 'message.read':
    case 'typing':
      ref
        ..invalidate(matchesControllerProvider)
        ..invalidate(threadControllerProvider);
    case 'match.created':
    case 'match.removed':
      ref
        ..invalidate(matchesControllerProvider)
        ..invalidate(discoveryControllerProvider);
    case 'like.received':
      ref.invalidate(likesControllerProvider);
    case 'entitlements.updated':
      ref
        ..invalidate(likesControllerProvider)
        ..invalidate(productsProvider);
    case 'sync.completed':
      ref
        ..invalidate(matchesControllerProvider)
        ..invalidate(threadControllerProvider)
        ..invalidate(discoveryControllerProvider)
        ..invalidate(likesControllerProvider)
        ..invalidate(profileControllerProvider);
  }
}
