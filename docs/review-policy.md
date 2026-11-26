# Review Policy

## Scope
Review only pull requests whose base branch is configured. The initial default is `develop`.

## Review dimensions
- Correctness and edge cases
- Regression risk and change impact
- Security and sensitive-data handling
- Resource lifecycle and performance
- Architecture and project conventions
- Error handling and observability

## Severity
- `critical`: severe security, data-loss, or system-wide impact.
- `high`: likely breakage of an important feature or workflow.
- `medium`: plausible functional issue with meaningful impact.
- `low`: concrete low-impact issue; avoid subjective suggestions.

## Publication policy
MVP uses GitHub review action `COMMENT`. It does not approve or request changes automatically. A finding must have evidence and a valid changed-line anchor to become an inline comment; otherwise it belongs in the summary or is omitted.

## False-positive policy
When uncertain, lower confidence or omit the finding. The goal is signal quality, not comment volume.
