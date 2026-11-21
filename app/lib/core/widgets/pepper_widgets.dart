import 'package:flutter/material.dart';
import 'package:pepper/core/config/brand.dart';

class PepperButton extends StatelessWidget {
  const PepperButton({
    required this.label,
    required this.onPressed,
    this.outlined = false,
    super.key,
  });
  final String label;
  final VoidCallback? onPressed;
  final bool outlined;
  @override
  Widget build(BuildContext context) {
    final child = Text(label);
    if (outlined) return OutlinedButton(onPressed: onPressed, child: child);
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: Brand.gradient,
        borderRadius: BorderRadius.all(Radius.circular(28)),
      ),
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          minimumSize: const Size.fromHeight(56),
        ),
        onPressed: onPressed,
        child: child,
      ),
    );
  }
}

class CircularActionButton extends StatelessWidget {
  const CircularActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.emphasized = false,
    super.key,
  });
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final bool emphasized;
  @override
  Widget build(BuildContext context) => Semantics(
        label: label,
        button: true,
        child: IconButton.filledTonal(
          style: IconButton.styleFrom(
            minimumSize: const Size.square(52),
            foregroundColor: emphasized ? Brand.white : Brand.red500,
            backgroundColor: emphasized
                ? Brand.red500
                : Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
          onPressed: onPressed,
          icon: Icon(icon),
        ),
      );
}

class PepperBadge extends StatelessWidget {
  const PepperBadge({required this.label, super.key});
  final String label;
  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: Brand.red500,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Brand.white,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      );
}

class PepperAvatar extends StatelessWidget {
  const PepperAvatar({
    required this.label,
    this.url,
    this.radius = 24,
    super.key,
  });
  final String label;
  final String? url;
  final double radius;
  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: radius,
        foregroundImage: url == null ? null : NetworkImage(url!),
        child: Text(label.isEmpty ? '?' : label.characters.first.toUpperCase()),
      );
}

class PepperImage extends StatelessWidget {
  const PepperImage({required this.url, this.fit = BoxFit.cover, super.key});
  final String url;
  final BoxFit fit;
  @override
  Widget build(BuildContext context) => Image.network(
        url,
        fit: fit,
        frameBuilder: (context, child, frame, _) => AnimatedOpacity(
          opacity: frame == null ? 0 : 1,
          duration: const Duration(milliseconds: 250),
          child: child,
        ),
        errorBuilder: (_, __, ___) => ColoredBox(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: const Center(child: Icon(Icons.broken_image_outlined)),
        ),
      );
}

class PepperEmptyState extends StatelessWidget {
  const PepperEmptyState({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
    super.key,
  });
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 52, color: Brand.grey400),
              const SizedBox(height: 16),
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(body, textAlign: TextAlign.center),
              if (action case final value?) ...[
                const SizedBox(height: 20),
                value,
              ],
            ],
          ),
        ),
      );
}

class PepperErrorView extends StatelessWidget {
  const PepperErrorView({required this.onRetry, super.key});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => PepperEmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Could not load this',
        body: 'Check your connection and try again.',
        action: PepperButton(label: 'Try again', onPressed: onRetry),
      );
}
