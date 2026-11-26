# MergePilot

**AI-powered pull request reviews, guided by engineering skills.**

MergePilot is an open-source GitHub pull request reviewer designed to help engineering teams catch meaningful defects, understand change impact, and apply consistent review standards.

It starts with Google Gemini and a PStack-inspired review workflow, while keeping the provider and review methodology boundaries extensible.

> Status: early development / pre-MVP. The GitHub Action runtime bootstrap is being established; AI review execution is not available yet.

## Goals

- Review pull requests targeting configured branches (initially `develop`).
- Analyze diffs with relevant repository context.
- Produce evidence-based findings with severity, confidence, and actionable explanations.
- Publish concise GitHub review summaries and inline comments.
- Let teams provide their own review rules and skills.
- Keep LLM provider integration replaceable.

## Current status

The Action collects pull request metadata and bounded changed-file patches, then loads shared review skills and language-specific guidance based on file extensions. It does **not** call Gemini or publish review comments yet.

## Usage (runtime smoke test)

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
        uses: adimunawar/mergepilot@feat/github-action-runtime
        with:
          gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          gemini-model: gemini-2.5-flash
          target-branches: develop
```

The branch reference above is for testing the runtime bootstrap. The diff collector is being developed on `feat/pr-diff-collector`; consumers should not use it as a production reviewer. Once a release is published, consumers should use a version tag such as `@v1`.

Each consuming repository supplies its own Gemini API key (BYOK) through GitHub Actions secrets. Never commit API keys.

## Non-goals for the initial MVP

- Automatically changing code or pushing commits.
- Automatically approving or merging pull requests.
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

## Configuration

| Input | Required | Default | Description |
|---|---:|---|---|
| `gemini-api-key` | Yes | — | Gemini API key supplied by the consuming repository |
| `github-token` | Yes | — | Token used for GitHub API access |
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
