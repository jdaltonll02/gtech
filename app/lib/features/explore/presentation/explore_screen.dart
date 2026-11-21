import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pepper/core/config/brand.dart';

class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key});
  static const themes = [
    (
      title: 'Ready for something real',
      subtitle: 'People looking for long-term connection',
      icon: Icons.favorite_outline
    ),
    (
      title: 'Liberian culture',
      subtitle: 'Food, music and traditions in common',
      icon: Icons.music_note_outlined
    ),
    (
      title: 'Adventure nearby',
      subtitle: 'Beach days, road trips and new places',
      icon: Icons.explore_outlined
    ),
    (
      title: 'Building big things',
      subtitle: 'Meet entrepreneurs and ambitious people',
      icon: Icons.rocket_launch_outlined
    ),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Explore')),
        body: GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            childAspectRatio: .88,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: themes.length,
          itemBuilder: (_, index) {
            final item = themes[index];
            return InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('${item.title} deck selected.')),
                );
                context.go('/discover');
              },
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: index.isEven ? Brand.red500 : Brand.ink800,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(item.icon, color: Brand.white, size: 38),
                      const Spacer(),
                      Text(
                        item.title,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              color: Brand.white,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.subtitle,
                        style: const TextStyle(color: Brand.white),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      );
}
