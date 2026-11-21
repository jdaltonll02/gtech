import 'package:go_router/go_router.dart';
import 'package:pepper/core/storage/token_storage.dart';
import 'package:pepper/features/auth/presentation/otp_screen.dart';
import 'package:pepper/features/auth/presentation/phone_screen.dart';
import 'package:pepper/features/billing/presentation/paywall_screen.dart';
import 'package:pepper/features/chat/presentation/chat_thread_screen.dart';
import 'package:pepper/features/chat/presentation/chats_screen.dart';
import 'package:pepper/features/discovery/presentation/discover_screen.dart';
import 'package:pepper/features/explore/presentation/explore_screen.dart';
import 'package:pepper/features/likes/presentation/likes_screen.dart';
import 'package:pepper/features/onboarding/domain/onboarding_step.dart';
import 'package:pepper/features/onboarding/presentation/onboarding_screen.dart';
import 'package:pepper/features/profile/presentation/edit_profile_screen.dart';
import 'package:pepper/features/profile/presentation/profile_screen.dart';
import 'package:pepper/features/profile/presentation/verification_screen.dart';
import 'package:pepper/features/settings/presentation/settings_screen.dart';
import 'package:pepper/features/shell/presentation/app_shell.dart';

GoRouter createRouter(TokenStorage storage) => GoRouter(
      initialLocation: '/auth/phone',
      redirect: (context, state) async {
        final signedIn = await storage.readAccessToken() != null;
        final auth = state.matchedLocation.startsWith('/auth/');
        if (!signedIn && !auth) return '/auth/phone';
        if (signedIn && auth) return '/discover';
        return null;
      },
      routes: [
        GoRoute(path: '/paywall', builder: (_, __) => const PaywallScreen()),
        GoRoute(path: '/auth/phone', builder: (_, __) => const PhoneScreen()),
        GoRoute(
          path: '/auth/otp',
          builder: (_, state) {
            final extra = state.extra as Map<String, String>?;
            return OtpScreen(
              challengeId: extra?['challenge_id'] ?? '',
              phone: extra?['phone'] ?? '',
            );
          },
        ),
        GoRoute(
          path: '/onboarding/:step',
          builder: (_, state) => OnboardingScreen(
            step: OnboardingStepPath.parse(
              state.pathParameters['step'] ?? 'name',
            ),
          ),
        ),
        StatefulShellRoute.indexedStack(
          builder: (_, __, shell) => AppShell(navigationShell: shell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/discover',
                  builder: (_, __) => const DiscoverScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/explore',
                  builder: (_, __) => const ExploreScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/likes',
                  builder: (_, __) => const LikesScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/chats',
                  builder: (_, __) => const ChatsScreen(),
                  routes: [
                    GoRoute(
                      path: ':matchId',
                      builder: (_, state) {
                        final extra = state.extra as Map<String, String>?;
                        return ChatThreadScreen(
                          matchId: state.pathParameters['matchId']!,
                          name: extra?['name'] ?? 'Conversation',
                          otherUserId: extra?['user_id'] ?? '',
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/profile',
                  builder: (_, __) => const ProfileScreen(),
                  routes: [
                    GoRoute(
                      path: 'edit',
                      builder: (_, __) => const EditProfileScreen(),
                    ),
                    GoRoute(
                      path: 'verify',
                      builder: (_, __) => const VerificationScreen(),
                    ),
                    GoRoute(
                      path: 'settings',
                      builder: (_, __) => const SettingsScreen(),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );
