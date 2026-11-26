# TypeScript Review

- Check whether types accurately represent runtime data; external input still needs runtime validation.
- Review unsafe any, unchecked casts, non-null assertions, and overly broad unions.
- Check discriminated union exhaustiveness and correct narrowing across async boundaries.
- Verify optional properties and nullability against actual API and serialization behavior.
- Avoid treating compile-time types as validation of network, file, or user input.
