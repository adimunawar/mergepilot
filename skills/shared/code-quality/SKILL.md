# Cross-language Code Quality Review

Apply these checks regardless of programming language. Use language-specific skills only as additional guidance.

- Trace changed behavior through relevant callers and consumers.
- Check boundary values, null/empty inputs, ordering, and state transitions.
- Check asynchronous work for races, cancellation, timeout, and error propagation.
- Check resource ownership and cleanup: files, streams, subscriptions, sockets, controllers, and transactions.
- Check API and data-contract compatibility, including serialization and persisted data.
- Check whether tests cover the changed behavior and meaningful edge cases.
- Avoid style-only comments and speculative claims. Tie every finding to changed code and observable impact.
