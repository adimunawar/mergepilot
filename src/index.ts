import * as core from "@actions/core";
import * as github from "@actions/github";
import { collectPullRequest } from "./github/pull-request.js";
import { loadRelevantSkills } from "./skills/skill-loader.js";
import { buildReviewContext } from "./context/context-builder.js";
import { collectSourceFiles } from "./context/source-files.js";

async function run(): Promise<void> {
  const geminiApiKey = core.getInput("gemini-api-key", { required: true });
  const githubToken = core.getInput("github-token", { required: true });
  const geminiModel = core.getInput("gemini-model") || "gemini-2.5-flash";
  const targetBranches = (core.getInput("target-branches") || "develop")
    .split(",")
    .map((branch) => branch.trim())
    .filter(Boolean);

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

  const octokit = github.getOctokit(githubToken);
  const snapshot = await collectPullRequest(
    octokit,
    context.repo.owner,
    context.repo.repo,
    pullRequest.number,
  );

  const skillResult = await loadRelevantSkills(snapshot.files.map((file) => file.filename));
  const sourceFiles = await collectSourceFiles(
    octokit,
    context.repo.owner,
    context.repo.repo,
    snapshot,
  );
  const reviewContext = buildReviewContext({
    pullRequest: snapshot,
    skills: skillResult,
    sourceFiles,
  });

  core.info("MergePilot PR diff and source context collection completed.");
  core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);
  core.info(`Pull request: #${snapshot.number} — ${snapshot.title}`);
  core.info(`Target branch: ${snapshot.baseRef}`);
  core.info(`Head commit: ${snapshot.headSha}`);
  core.info(`Changed files collected: ${snapshot.files.length}/${snapshot.totalChangedFiles}`);
  core.info(`Patch characters collected: ${snapshot.totalPatchCharacters}`);
  core.info(`Detected languages: ${skillResult.detectedLanguages.join(", ") || "none"}`);
  core.info(`Loaded review skills: ${reviewContext.includedSkills.join(", ")}`);
  core.info(`Source snapshots included: ${reviewContext.includedSourceFiles.length}; omitted: ${reviewContext.omittedSourceFiles.length}`);
  core.info(`Review context characters: ${reviewContext.characterCount}`);
  core.info(`Diff files included: ${reviewContext.includedFiles.length}; omitted: ${reviewContext.omittedFiles.length}`);
  if (reviewContext.truncated) {
    core.warning("Review context reached one or more safety limits; some content was truncated or omitted.");
  }
  if (snapshot.filesTruncated) {
    core.warning("Changed file list was truncated by the configured safety limit.");
  }

  for (const file of snapshot.files) {
    const patchLength = file.patch?.length ?? 0;
    core.info(
      `- ${file.filename} (${file.status}, +${file.additions}/-${file.deletions}, patch: ${patchLength} chars)`,
    );
    if (file.patchTruncated) {
      core.warning(`Patch was truncated for ${file.filename}.`);
    }
  }

  core.info(`Gemini model configured for the next review stage: ${geminiModel}`);
  core.warning(
    "Gemini analysis and GitHub review publishing are not implemented yet. This run collects PR diffs, source snapshots, selects skills, and builds bounded review context.",
  );
}

run().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  core.setFailed(message);
});
