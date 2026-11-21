import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pepper/features/discovery/domain/discovery_card.dart';
import 'package:pepper/features/discovery/presentation/swipe_deck.dart';

const card = DiscoveryCardModel(
  id: '01900000-0000-7000-8000-000000000001',
  name: 'Ayo',
  age: 27,
  distanceLabel: 'Nearby',
  county: 'Montserrado',
  jobTitle: '',
  school: '',
  bio: '',
  interests: [],
  photos: [],
  verified: false,
  superlikedYou: false,
);

Widget deck({
  required Future<void> Function(DiscoveryCardModel, SwipeAction) onSwipe,
  SwipeDeckController? controller,
}) =>
    MaterialApp(
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: 400,
            height: 600,
            child: SwipeDeck(
              cards: const [card],
              controller: controller,
              cardBuilder: (_, value) => ColoredBox(
                color: Colors.black,
                child: Text(value.name),
              ),
              onSwipe: onSwipe,
            ),
          ),
        ),
      ),
    );

void main() {
  testWidgets('drag beyond threshold submits a like', (tester) async {
    SwipeAction? action;
    await tester.pumpWidget(
      deck(onSwipe: (_, value) async => action = value),
    );
    await tester.drag(
      find.byKey(const ValueKey('top-card')),
      const Offset(150, 0),
    );
    await tester.pumpAndSettle();
    expect(action, SwipeAction.like);
  });

  testWidgets('short drag snaps back without submitting', (tester) async {
    var calls = 0;
    await tester.pumpWidget(
      deck(onSwipe: (_, __) async => calls++),
    );
    await tester.drag(
      find.byKey(const ValueKey('top-card')),
      const Offset(40, 0),
    );
    await tester.pumpAndSettle();
    expect(calls, 0);
  });

  testWidgets('action controller submits a Super Like', (tester) async {
    SwipeAction? action;
    final controller = SwipeDeckController();
    await tester.pumpWidget(
      deck(
        controller: controller,
        onSwipe: (_, value) async => action = value,
      ),
    );
    controller.swipe(SwipeAction.superlike);
    await tester.pump();
    expect(action, SwipeAction.superlike);
    controller.dispose();
  });
}
