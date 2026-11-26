# MergePilot

**AI-powered pull request reviews, guided by engineering skills.**

MergePilot is an open-source GitHub pull request reviewer designed to help engineering teams catch meaningful defects, understand change impact, and apply consistent review standards.

It starts with Google Gemini and a PStack-inspired review workflow, while keeping the provider and review methodology boundaries extensible.

> Status: early foundation / pre-MVP. APIs and workflows may change.

## Goals

- Review pull requests targeting configured branches (initially `develop`).
- Analyze diffs with relevant repository context.
- Produce evidence-based findings with severity, confidence, and actionable explanations.
- Publish concise GitHub review summaries and inline comments.
- Let teams provide their own review rules and skills.
- Keep LLM provider integration replaceable.

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

## Planned workflow

1. Trigger on `pull_request` events: `opened`, `synchronize`, and `reopened`.
2. Ignore PRs whose base branch is not configured.
3. Collect PR metadata, changed files, diff hunks, and limited related context.
4. Load global and project-specific review instructions.
5. Run the review workflow using the configured Gemini model.
6. Validate findings: evidence, severity, confidence, and changed-line anchoring.
7. Publish a single review summary and valid inline comments.
8. Record the reviewed commit SHA to avoid duplicate reviews.

## Repository layout

```text
.github/
  workflows/             # GitHub Actions integration
  ISSUE_TEMPLATE/
docs/
  architecture.md
  configuration.md
  security.md
  review-policy.md
skills/
  team-pr-review/
    SKILL.md
src/
  core/
  providers/
    gemini/
  github/
  review/
  validators/
tests/
examples/
```

## Configuration (planned)

Configuration is supplied through environment variables and a repository config file. See [docs/configuration.md](docs/configuration.md).

Never commit API keys. Use GitHub Actions secrets for `GEMINI_API_KEY`.

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

The implementation scaffold is being established. The initial planned runtime is Node.js + TypeScript, with the official Google Gen AI SDK and GitHub Actions.

```bash
npm install
npm run typecheck
npm test
```

## License

MIT. See [LICENSE](LICENSE).
