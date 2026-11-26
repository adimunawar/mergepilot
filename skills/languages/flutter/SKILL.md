# Flutter Review

- Check widget lifecycle and correct use of initState, didUpdateWidget, dispose, and mounted.
- Check BuildContext use across async gaps and navigation/dialog operations.
- Review state ownership and update propagation; look for stale state, duplicate sources of truth, and unnecessary rebuilds with user-visible impact.
- Check controllers, FocusNodes, AnimationControllers, ScrollControllers, subscriptions, and other disposable objects.
- Review layout constraints, scrolling, large lists, image loading, and expensive work in build methods.
- Check navigation arguments, deep links, route guards, and back-stack behavior when routing changes.
- Check platform permissions, Android/iOS lifecycle, and plugin compatibility when native integrations change.
- Do not impose Provider, Riverpod, Bloc, or another state-management library unless the repository already uses it or the PR introduces it.
