enum OnboardingStep {
  name,
  birthday,
  gender,
  showMe,
  goal,
  photos,
  interests,
  languages,
  location,
  notifications
}

extension OnboardingStepPath on OnboardingStep {
  String get path => name == 'showMe' ? 'show-me' : name;
  static OnboardingStep parse(String value) => OnboardingStep.values.firstWhere(
        (step) => step.path == value,
        orElse: () => OnboardingStep.name,
      );
  OnboardingStep? get next {
    final index = OnboardingStep.values.indexOf(this) + 1;
    return index < OnboardingStep.values.length
        ? OnboardingStep.values[index]
        : null;
  }
}
