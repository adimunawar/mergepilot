# Configuration

Initial configuration is environment-based. A repository-level `.mergepilot.yml` may be added after the MVP contract is validated.

| Variable | Required | Description |
|---|---:|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key. Store as a GitHub Actions secret. |
| `GEMINI_MODEL` | No | Model ID supported by the configured Gemini API account. |
| `MERGEPILOT_TARGET_BRANCHES` | No | Comma-separated target branches; defaults to `develop`. |
| `GITHUB_TOKEN` | In CI | Token used by the GitHub adapter. |

Do not commit `.env` files or credentials. Model names and free-tier quotas can change; choose a currently available model in Google AI Studio and configure it explicitly.
