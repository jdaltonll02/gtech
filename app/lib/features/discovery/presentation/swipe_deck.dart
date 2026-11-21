import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:pepper/core/config/brand.dart';
import 'package:pepper/features/discovery/domain/discovery_card.dart';

final class SwipeDeckController extends ChangeNotifier {
  SwipeAction? _action;
  SwipeAction? takeAction() {
    final value = _action;
    _action = null;
    return value;
  }

  void swipe(SwipeAction value) {
    _action = value;
    notifyListeners();
  }
}

class SwipeDeck extends StatefulWidget {
  const SwipeDeck({
    required this.cards,
    required this.cardBuilder,
    required this.onSwipe,
    this.controller,
    super.key,
  });
  final List<DiscoveryCardModel> cards;
  final Widget Function(BuildContext, DiscoveryCardModel) cardBuilder;
  final Future<void> Function(DiscoveryCardModel, SwipeAction) onSwipe;
  final SwipeDeckController? controller;
  @override
  State<SwipeDeck> createState() => _SwipeDeckState();
}

class _SwipeDeckState extends State<SwipeDeck> {
  Offset offset = Offset.zero;
  @override
  void initState() {
    super.initState();
    widget.controller?.addListener(_programmaticSwipe);
  }

  @override
  void didUpdateWidget(covariant SwipeDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?.removeListener(_programmaticSwipe);
      widget.controller?.addListener(_programmaticSwipe);
    }
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_programmaticSwipe);
    super.dispose();
  }

  void _programmaticSwipe() {
    final action = widget.controller?.takeAction();
    if (action != null && widget.cards.isNotEmpty) _complete(action);
  }

  Future<void> _complete(SwipeAction action) async {
    if (widget.cards.isEmpty) return;
    final card = widget.cards.first;
    setState(() => offset = Offset.zero);
    await widget.onSwipe(card, action);
  }

  SwipeAction? _actionFor(double width) {
    if (offset.dx > width * .24) return SwipeAction.like;
    if (offset.dx < -width * .24) return SwipeAction.nope;
    if (offset.dy < -width * .20) return SwipeAction.superlike;
    return null;
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, size) {
          if (widget.cards.isEmpty) return const SizedBox.shrink();
          final visible = widget.cards.take(3).toList().reversed.toList();
          return Stack(
            children: visible.map((card) {
              final isTop = card.id == widget.cards.first.id;
              if (!isTop) {
                return Positioned.fill(
                  child: Transform.scale(
                    scale: .96,
                    child: widget.cardBuilder(context, card),
                  ),
                );
              }
              final action = _actionFor(size.maxWidth);
              return Positioned.fill(
                child: GestureDetector(
                  key: const ValueKey('top-card'),
                  onPanUpdate: (details) =>
                      setState(() => offset += details.delta),
                  onPanEnd: (_) {
                    final selected = _actionFor(size.maxWidth);
                    if (selected == null) {
                      setState(() => offset = Offset.zero);
                    } else {
                      _complete(selected);
                    }
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    curve: Curves.easeOut,
                    transform: Matrix4.identity()
                      ..translateByDouble(offset.dx, offset.dy, 0, 1)
                      ..rotateZ(offset.dx / size.maxWidth * math.pi / 18),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        widget.cardBuilder(context, card),
                        if (action != null) _SwipeStamp(action: action),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          );
        },
      );
}

class _SwipeStamp extends StatelessWidget {
  const _SwipeStamp({required this.action});
  final SwipeAction action;
  @override
  Widget build(BuildContext context) => Align(
        alignment:
            action == SwipeAction.nope ? Alignment.topRight : Alignment.topLeft,
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Transform.rotate(
            angle: action == SwipeAction.nope ? math.pi / 12 : -math.pi / 12,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Brand.black.withValues(alpha: .45),
                border: Border.all(color: Brand.red500, width: 4),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  action.name.toUpperCase(),
                  style: const TextStyle(
                    color: Brand.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}
