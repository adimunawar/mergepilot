# MergePilot Review Rubric

Use this rubric to decide whether a suspected issue deserves a finding. The goal is high-signal defect detection, not maximum comment count.

## Review dimensions

1. **Correctness and behavior** — broken assumptions, incorrect conditions, invalid state transitions, boundary cases, nullability, ordering, and data integrity.
2. **Regression and compatibility** — changed contracts, callers, persisted data, serialization, API behavior, and backward compatibility.
3. **Security and trust boundaries** — authorization, input validation, injection, secret exposure, unsafe deserialization, and untrusted content handling.
4. **Concurrency and lifecycle** — races, cancellation, retries, timeouts, resource ownership, cleanup, and platform lifecycle.
5. **Reliability and performance** — failure propagation, partial failures, resource exhaustion, avoidable expensive work, and degraded behavior.
6. **Tests and observability** — missing coverage for changed behavior, misleading diagnostics, and error paths that become hard to operate.

## Evidence standard

Before reporting a suspected issue:

- Identify the exact changed line that introduces or exposes it.
- Trace the relevant input, state, caller, or consumer far enough to establish the behavior.
- State the triggering condition and concrete user/system impact.
- Distinguish proven behavior from assumptions. Do not invent APIs, runtime guarantees, or execution results.
- Check whether existing guards, validation, tests, or downstream handling already prevent the issue.
- If essential context is unavailable, lower confidence or omit the finding.
- Do not report a missing test alone as a defect unless the change also creates a concrete risk.

## Actionability decision

Classify each candidate internally before returning it:

- **Act on** — a concrete defect or security/correctness risk with a supported trigger and meaningful impact. These are eligible for findings.
- **Consider** — a plausible improvement or risk whose impact depends on context. Report only when the changed code and evidence make the consequence useful and specific; otherwise omit.
- **Noted** — useful context or a trade-off, but no action is required. Do not create an inline finding.
- **Dismissed** — speculative, duplicate, unrelated, unsupported, or already mitigated. Do not report it.

Only actionable, evidence-backed candidates should appear in the findings array. The internal classification is a reasoning aid; do not add extra output fields or prose outside the required JSON schema.

## Severity calibration

- **Critical** — exploitable security issue, irreversible data loss, or severe system-wide failure.
- **High** — likely functional defect in an important flow, or a serious security weakness.
- **Medium** — meaningful defect under a realistic but narrower condition.
- **Low** — limited-impact defect with a concrete and reproducible consequence.

Confidence must reflect evidence strength, not how strongly the issue is worded. Prefer fewer precise findings over speculative volume.
