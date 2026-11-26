# MergePilot

**AI-powered pull request reviews, guided by engineering skills.**

MergePilot is an open-source GitHub pull request reviewer designed to help engineering teams catch meaningful defects, understand change impact, and apply consistent review standards.

> Status: early development / pre-MVP. The current implementation collects bounded PR context, runs an AI provider, validates findings, and publishes advisory GitHub COMMENT reviews.

## Goals

- Review pull requests targeting configured branches (initially `develop`).
- Analyze diffs with relevant repository context.
- Produce evidence-based findings with severity, confidence, and actionable explanations.
- Publish concise GitHub review summaries and inline comments.
- Let teams provide their own review rules and skills.
- Let each repository choose its AI provider, API key, and model (BYOK).

## Current capabilities

The Action collects pull request metadata and bounded changed-file patches, selects shared and language-specific skills, fetches bounded source snapshots at the exact PR head SHA, assembles review context, calls the configured AI provider for structured findings, validates findings against added diff lines, and publishes a GitHub `COMMENT` review.

Supported providers:
- **Google Gemini** — structured JSON response mode.
- **NVIDIA NIM** — OpenAI-compatible chat completions with JSON mode.

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
          ai-provider: gemini
          ai-api-key: ${{ secrets.GEMINI_API_KEY }}
          ai-model: gemini-3.8-flash
          github-token: ${{ secrets.GITHUB_TOKEN }}
          target-branches: develop
```

### Use NVIDIA NIM

```yaml
      - name: Run MergePilot
        uses: adimunawar/mergepilot@develop
        with:
          ai-provider: nvidia
          ai-api-key: ${{ secrets.NVIDIA_API_KEY }}
          ai-model: YOUR_NVIDIA_MODEL_ID
          github-token: ${{ secrets.GITHUB_TOKEN }}
          target-branches: develop
```

Choose a model ID available to your NVIDIA API account in the NVIDIA API Catalog. MergePilot deliberately does not hardcode a NVIDIA model default because availability and access can vary. The default NVIDIA endpoint is `https://integrate.api.nvidia.com/v1`; use `ai-base-url` only for a compatible endpoint.

Each consuming repository supplies its own provider API key (BYOK) through GitHub Actions secrets. Never commit API keys. The selected provider, key, and model are independent inputs. Existing `gemini-api-key` and `gemini-model` inputs remain supported for backward compatibility.

Use a tagged release (for example `@v1`) when one is published. The `develop` ref is intended for testing and may change.

## Skill system

MergePilot uses a language-agnostic review baseline plus language-specific skill packs. The registry in `skills/registry.json` maps file extensions to skills, while `skills/manifest.json` maps skill IDs to Markdown instructions. Only the default skills and packs matching changed files are loaded. Unknown extensions are reported but do not prevent review.

## Review context and validation

The context builder combines PR metadata, the PR description, selected skill instructions, optional repository guidance, changed-file patches, and bounded source snapshots of changed files. Source files are fetched at the PR head SHA. Context size is limited, and repository-controlled text is treated as untrusted input.

The selected provider returns structured JSON. MergePilot validates the schema, file paths, line numbers, duplicate findings, and whether the reported line is an added line in the PR diff. Only validated findings are published. Findings are advisory and should be verified by a human reviewer.

## Configuration

| Input | Required | Default | Description |
|---|---:|---|---|
| `ai-provider` | No | `gemini` | Provider: `gemini` or `nvidia` |
| `ai-api-key` | Yes* | — | API key for the selected provider; use Actions secrets |
| `ai-model` | Yes for NVIDIA | Gemini default | Provider-specific model identifier |
| `ai-base-url` | No | NVIDIA NIM endpoint | Optional OpenAI-compatible API base URL |
| `github-token` | Yes | — | Token used for GitHub API access; needs pull request write permission |
| `target-branches` | No | `develop` | Comma-separated target branches |

*For backward compatibility, Gemini can use `gemini-api-key` / `GEMINI_API_KEY`, and NVIDIA can use `nvidia-api-key` / `NVIDIA_API_KEY`. Provider-specific model aliases are also supported.

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
