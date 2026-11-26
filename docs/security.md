# Security

MergePilot processes untrusted pull request content. The review pipeline must assume that code, comments, filenames, commit messages, and documentation may contain prompt-injection attempts.

## MVP security requirements

- Never execute pull request code to perform an AI review.
- Never pass secrets, tokens, environment dumps, or unrelated private files to the LLM.
- Use a GitHub token with only the permissions required to read PR contents and write PR review comments.
- Do not expose `GEMINI_API_KEY` to untrusted fork workflows.
- For fork pull requests, use a safe workflow pattern that does not grant write permissions or expose secrets. If safe review cannot be performed, skip with an explicit explanation.
- Limit file size, diff size, and total context tokens.
- Treat provider output as untrusted; validate JSON and line anchors before publishing.
- Do not allow model output to select arbitrary URLs, shell commands, or GitHub API operations.
- Log metadata and errors, not source contents or credentials by default.

## Data handling decision

Before enabling the bot on private company repositories, the repository owner must review Google's current Gemini API data-use terms and the organization's source-code policy. The Free Tier must not be assumed appropriate for proprietary code.
