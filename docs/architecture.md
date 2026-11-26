# Architecture

## Design principles

1. Provider-independent core: review orchestration must not depend on Gemini-specific types.
2. Evidence before comments: findings are validated before GitHub publication.
3. Least privilege: GitHub permissions and provider context are minimized.
4. Bounded context: include changed files and relevant dependencies, not the whole repository by default.
5. Human decision-making: MergePilot comments; it does not approve or merge automatically in the MVP.

## Components

- GitHub adapter: fetches PR metadata, changed files, diff hunks, existing review threads, and publishes review output.
- Context builder: combines PR metadata, selected skills, repository guidance, and bounded diffs; reports truncation and omitted files. Context enrichment with surrounding source files is a later stage.
- Skill registry and loader: selects language-agnostic baseline skills and language-specific skill packs based on changed file extensions; repository-specific rules can be added as a later layer.
- Review orchestrator: coordinates context, provider, validation, and publishing.
- LLM provider: interface for model calls; Gemini is the first adapter.
- Finding validator: validates schema, evidence, confidence, severity, and diff anchoring.
- Review publisher: emits one summary and inline comments.

## Planned execution stages

`collect -> detect languages -> load skills -> build bounded context -> understand -> analyze -> verify -> publish`

Each stage should be observable and independently testable. Provider output is untrusted and must be parsed and validated.
