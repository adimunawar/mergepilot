# MergePilot

**AI-powered pull request reviews, guided by engineering skills.**

MergePilot is an open-source GitHub pull request reviewer designed to help engineering teams catch meaningful defects, understand change impact, and apply consistent review standards.

It starts with Google Gemini and a PStack-inspired review workflow, while keeping the provider and review methodology boundaries extensible.

> Status: early development / pre-MVP. The current implementation collects bounded PR context, runs Gemini analysis, validates findings, and publishes advisory GitHub COMMENT reviews. Production hardening and broader integration testing are still in progress.

## Goals

- Review pull requests targeting configured branches (initially `develop`).
- Analyze diffs with relevant repository context.
- Produce evidence-based findings with severity, confidence, and actionable explanations.
- Publish concise GitHub review summaries and inline comments.
- Let teams provide their own review rules and skills.
- Keep LLM provider integration replaceable.

## Current capabilities

The Action collects pull request metadata and bounded changed-file patches, selects shared and language-specific skills, fetches bounded source snapshots at the exact PR head SHA, assembles review context, calls Gemini for structured findings, validates findings against added diff lines, and publishes a GitHub `COMMENT` review with inline comments.

MergePilot does not approve, request changes, edit code, push commits, or merge pull requests.

## Usage

Add this workflow to a consuming repository at `.github/workflows/mergepilot.yml`:

```yaml
name: MergePilot

on:
  pull_request:
    branches: [develop]
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Run MergePilot
        uses: adimunawar/mergepilot@develop
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-model: gemini-2.5-flash
          target-branches: develop
```

Use a tagged release (for example `@v1`) when one is published. The `develop` ref is intended for testing and may change.

Each consuming repository supplies its own Gemini API key (BYOK) through GitHub Actions secrets. Never commit API keys.

## Non-goals for the initial MVP

- Automatically changing code or pushing commits.
- Automatically approving, requesting changes, or merging pull requests.
- Replacing human reviewers.
- Sending entire repositories or secrets to an LLM by default.
- Requiring contributors to install PStack locally.

## Planned architecture

```text
GitHub Actions
    |
    v
MergePilot CLI / Review Orchestrator
    |-- GitHub adapter (PR metadata, diff, files, comments)
    |-- Context builder (bounded, relevant repository context)
    |-- Skill/workflow loader (team rules and review procedures)
    |-- LLM provider interface
    |     `-- Gemini provider (initial implementation)
    |-- Finding validator (schema, diff location, evidence)
    `-- Review publisher (summary + inline comments)
```

## Skill system

MergePilot uses a language-agnostic review baseline plus language-specific skill packs. The registry in `skills/registry.json` maps file extensions to skills, while `skills/manifest.json` maps skill IDs to Markdown instructions. Only the default skills and packs matching changed files are loaded. Unknown extensions are reported but do not prevent review. Add a language by creating its skill Markdown file, registering it in the manifest, and mapping its extensions in the registry.

Initial language packs include Dart/Flutter, JavaScript/TypeScript, Python, Go, Java/Kotlin, Rust, Ruby, PHP, Swift, and C#. The shared review policy applies to all languages; language packs add ecosystem-specific checks rather than replacing it.

## Review context and validation

The context builder combines PR metadata, the PR description, selected skill instructions, optional repository guidance, changed-file patches, and bounded source snapshots of changed files. Source files are fetched at the PR head SHA. Context size is limited, and repository-controlled text is treated as untrusted input.

Gemini returns structured JSON. MergePilot validates the schema, file paths, line numbers, duplicate findings, and whether the reported line is an added line in the PR diff. Only validated findings are published. Findings are advisory and should be verified by a human reviewer.

## Configuration

| Input | Required | Default | Description |
|---|---:|---|---|
| `gemini-api-key` | Yes | — | Gemini API key supplied by the consuming repository |
| `github-token` | Yes | — | Token used for GitHub API access; needs pull request write permission to publish reviews |
| `gemini-model` | No | `gemini-2.5-flash` | Gemini model identifier |
| `target-branches` | No | `develop` | Comma-separated target branches |

## Security principles

- Treat PR content, comments, filenames, and repository files as untrusted input.
- Do not execute code from a pull request as part of AI review.
- Do not expose secrets or environment variables to the model.
- Minimize context sent to the provider.
- Do not run privileged workflows for untrusted fork PRs.
- Use least-privilege GitHub permissions.
- Validate model output before publishing comments.
- Publish only `COMMENT` reviews; never auto-approve or request changes.

See [docs/security.md](docs/security.md).

## Development

Requires Node.js 24 or newer.

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT. See [LICENSE](LICENSE).
