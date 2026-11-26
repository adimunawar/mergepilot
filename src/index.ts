import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadConfig } from "./core/config.js";
import { collectPullRequest } from "./github/pull-request.js";
import { publishReview } from "./github/review-publisher.js";
import { loadRelevantSkills } from "./skills/skill-loader.js";
import { buildReviewContext } from "./context/context-builder.js";
import { collectSourceFiles } from "./context/source-files.js";
import { createAIProvider, reviewPullRequest } from "./review/gemini-reviewer.js";
import { respondToReviewConversation } from "./review/conversation-responder.js";

async function handleReviewCommentReply(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
  comment: {
    id: number;
    user?: { login?: string; type?: string } | null;
    in_reply_to_id?: number;
  },
  config: ReturnType<typeof loadConfig>,
): Promise<void> {
  if (!comment.in_reply_to_id || comment.user?.type === "Bot") {
    core.info("Skipping review comment: it is not a developer reply.");
    return;
  }

  const threadComments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });
  const parent = threadComments.find((item) => item.id === comment.in_reply_to_id);
  if (
    !parent
    || parent.user?.type !== "Bot"
    || !parent.body?.includes("<!-- mergepilot-finding:")
  ) {
    core.info("Skipping review comment: parent is not a MergePilot finding.");
    return;
  }

  const pullRequest = await collectPullRequest(octokit, owner, repo, pullNumber);
  const conversation = threadComments
    .filter((item) => item.id === parent.id || item.in_reply_to_id === parent.id)
    .sort((a, b) => a.id - b.id)
    .map((item) => ({
      id: item.id,
      author: item.user?.login ?? "unknown",
      body: item.body,
    }));

  const response = await respondToReviewConversation(
    createAIProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    }),
    config.model,
    {
      pullRequestTitle: pullRequest.title,
      pullRequestBody: pullRequest.body,
      changedFiles: pullRequest.files.map((file) => file.filename),
      diffs: pullRequest.files.flatMap((file) => file.patch ? [{ filename: file.filename, patch: file.patch }] : []),
      comments: conversation,
    },
  );

  await octokit.rest.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: pullNumber,
    comment_id: comment.id,
    body: response.reply,
  });
  core.info(`Replied to MergePilot review thread #${parent.id} (disposition: ${response.disposition}).`);
}

async function run(): Promise<void> {
  const config = loadConfig({
    ...process.env,
    AI_PROVIDER: core.getInput("ai-provider") || process.env.AI_PROVIDER,
    AI_API_KEY: core.getInput("ai-api-key") || process.env.AI_API_KEY,
    AI_MODEL: core.getInput("ai-model") || process.env.AI_MODEL,
    AI_BASE_URL: core.getInput("ai-base-url") || process.env.AI_BASE_URL,
    GEMINI_API_KEY: core.getInput("gemini-api-key") || process.env.GEMINI_API_KEY,
    GEMINI_MODEL: core.getInput("gemini-model") || process.env.GEMINI_MODEL,
    NVIDIA_API_KEY: core.getInput("nvidia-api-key") || process.env.NVIDIA_API_KEY,
    NVIDIA_MODEL: core.getInput("nvidia-model") || process.env.NVIDIA_MODEL,
  });
  const githubToken = core.getInput("github-token", { required: true });
  const targetBranches = (core.getInput("target-branches") || config.targetBranches.join(","))
    .split(",").map((branch) => branch.trim()).filter(Boolean);

  const context = github.context;
  const octokit = github.getOctokit(githubToken);

  if (context.eventName === "pull_request_review_comment") {
    const pullRequest = context.payload.pull_request;
    const comment = context.payload.comment;
    if (!pullRequest || !comment) {
      throw new Error("Review comment event is missing pull request or comment data.");
    }
    if (!targetBranches.includes(pullRequest.base.ref)) {
      core.notice(`Skipping PR #${pullRequest.number}: base branch "${pullRequest.base.ref}" is not configured for review.`);
      return;
    }
    await handleReviewCommentReply(
      octokit,
      context.repo.owner,
      context.repo.repo,
      pullRequest.number,
      comment,
      config,
    );
    return;
  }

  const pullRequest = context.payload.pull_request;
  if (context.eventName !== "pull_request" || !pullRequest) {
    throw new Error("MergePilot must run from a pull_request or pull_request_review_comment event.");
  }
  const baseBranch = pullRequest.base.ref;
  if (!targetBranches.includes(baseBranch)) {
    core.notice(`Skipping PR #${pullRequest.number}: base branch "${baseBranch}" is not configured for review.`);
    return;
  }

  const snapshot = await collectPullRequest(octokit, context.repo.owner, context.repo.repo, pullRequest.number);
  const skillResult = await loadRelevantSkills(snapshot.files.map((file) => file.filename));
  const sourceFiles = await collectSourceFiles(octokit, context.repo.owner, context.repo.repo, snapshot);
  const reviewContext = buildReviewContext({ pullRequest: snapshot, skills: skillResult, sourceFiles });

  core.info("MergePilot review context collection completed.");
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
  if (reviewContext.truncated) core.warning("Review context reached one or more safety limits; some content was truncated or omitted.");
  if (snapshot.filesTruncated) core.warning("Changed file list was truncated by the configured safety limit.");

  const review = await reviewPullRequest(reviewContext, snapshot, {
    provider: config.provider, apiKey: config.apiKey, model: config.model, baseUrl: config.baseUrl,
  });
  core.info(`${config.provider} review completed with ${review.findings.length} validated finding(s).`);
  const summary = review.summary || "Automated review completed.";
  core.info(`Review summary: ${summary}`);
  for (const finding of review.findings) {
    core.info(`[${finding.severity.toUpperCase()}] ${finding.filePath}:${finding.line} — ${finding.title} (confidence: ${finding.confidence})`);
  }
  await publishReview(octokit, snapshot, review, {
    owner: context.repo.owner, repo: context.repo.repo,
    pullNumber: snapshot.number, commitSha: snapshot.headSha,
  });
  core.info(`Published MergePilot COMMENT review for PR #${snapshot.number}.`);
  core.setOutput("finding-count", review.findings.length);
  core.setOutput("review-summary", summary);
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : "An unexpected error occurred.");
});
