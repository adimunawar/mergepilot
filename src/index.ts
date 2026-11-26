import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  const geminiApiKey = core.getInput("gemini-api-key", { required: true });
  const githubToken = core.getInput("github-token", { required: true });
  const geminiModel = core.getInput("gemini-model") || "gemini-2.5-flash";
  const targetBranches = (core.getInput("target-branches") || "develop")
    .split(",")
    .map((branch) => branch.trim())
    .filter(Boolean);

  // Constructing the client confirms that the GitHub token is wired in.
  // Network operations are added with the GitHub adapter.
  github.getOctokit(githubToken);

  const context = github.context;
  const pullRequest = context.payload.pull_request;

  if (context.eventName !== "pull_request" || !pullRequest) {
    throw new Error("MergePilot must run from a pull_request event.");
  }

  const baseBranch = pullRequest.base.ref;
  if (!targetBranches.includes(baseBranch)) {
    core.notice(
      `Skipping PR #${pullRequest.number}: base branch "${baseBranch}" is not configured for review.`,
    );
    return;
  }

  if (!geminiApiKey.trim()) {
    throw new Error("A non-empty Gemini API key is required.");
  }

  core.info("MergePilot GitHub Action runtime initialized.");
  core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);
  core.info(`Pull request: #${pullRequest.number}`);
  core.info(`Target branch: ${baseBranch}`);
  core.info(`Gemini model configured: ${geminiModel}`);
  core.warning(
    "Review execution is not implemented yet. This run only verifies Action configuration and PR context.",
  );
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  core.setFailed(message);
});
