import * as github from "@actions/github";
import type { PullRequestSnapshot } from "./pull-request.js";
import type { ReviewResult } from "../review/types.js";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface PublishReviewOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
}

function formatFinding(finding: ReviewResult["findings"][number]): string {
  const lines = [
    `**[${finding.severity.toUpperCase()}] ${finding.title}**`,
    finding.description,
  ];
  if (finding.suggestion) lines.push(`**Suggestion:** ${finding.suggestion}`);
  lines.push(`_Confidence: ${Math.round(finding.confidence * 100)}%_`);
  return lines.join("\n\n");
}

export async function publishReview(
  octokit: Octokit,
  pullRequest: PullRequestSnapshot,
  result: ReviewResult,
  options: PublishReviewOptions,
): Promise<void> {
  const availableFiles = new Set(
    pullRequest.files
      .filter((file) => file.patch !== undefined && file.status !== "removed")
      .map((file) => file.filename),
  );

  const comments = result.findings
    .filter((finding) => availableFiles.has(finding.filePath))
    .map((finding) => ({
      path: finding.filePath,
      line: finding.line,
      side: "RIGHT" as const,
      body: formatFinding(finding),
    }));

  const summary = [
    "## MergePilot Review",
    result.summary || "Automated review completed.",
    "",
    `**Validated findings:** ${comments.length}`,
    "",
    "_This review is advisory. Please verify findings before making changes._",
  ].join("\n");

  await octokit.rest.pulls.createReview({
    owner: options.owner,
    repo: options.repo,
    pull_number: options.pullNumber,
    commit_id: options.commitSha,
    event: "COMMENT",
    body: summary,
    comments,
  });
}
