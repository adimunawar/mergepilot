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

The Action runtime currently validates its inputs and pull request context. It does **not** call Gemini, inspect diffs, or publish review comments yet. Those capabilities will be implemented in subsequent milestones.

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

The branch reference above is for testing this development branch. Once a release is published, consumers should use a version tag such as `@v1`.

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

The build compiles TypeScript and bundles runtime dependencies into `action-dist/index.js`, which is committed with the Action release.

## License

MIT. See [LICENSE](LICENSE).
