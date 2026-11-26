import { describe, expect, it, vi } from "vitest";
import { publishReview } from "../src/github/review-publisher.js";
import type { PullRequestSnapshot } from "../src/github/pull-request.js";
import type { ReviewResult } from "../src/review/types.js";

const snapshot: PullRequestSnapshot = {
  number: 42,
  title: "Add feature",
  body: "",
  baseRef: "develop",
  headRef: "feature",
  baseSha: "base",
  headSha: "head-sha",
  totalChangedFiles: 1,
  files: [{
    filename: "src/app.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: "@@ -1 +1 @@\n+const enabled = true;",
    patchTruncated: false,
  }],
  filesTruncated: false,
  totalPatchCharacters: 30,
};

const review: ReviewResult = {
  summary: "One potential correctness issue.",
  findings: [{
    filePath: "src/app.ts",
    line: 1,
    endLine: 1,
    severity: "high",
    title: "Missing validation",
    description: "The value is used without validation.",
    suggestion: "Validate the value before use.",
    confidence: 0.95,
  }],
};

describe("publishReview", () => {
  it("posts a COMMENT review anchored to the PR head commit", async () => {
    const createReview = vi.fn().mockResolvedValue({});
    const octokit = { rest: { pulls: { createReview } } } as never;

    await publishReview(octokit, snapshot, review, {
      owner: "owner",
      repo: "repo",
      pullNumber: 42,
      commitSha: "head-sha",
    });

    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
      owner: "owner",
      repo: "repo",
      pull_number: 42,
      commit_id: "head-sha",
      event: "COMMENT",
      comments: [{
        path: "src/app.ts",
        line: 1,
        side: "RIGHT",
        body: expect.stringContaining("[HIGH] Missing validation"),
      }],
    }));
  });

  it("publishes a summary without inline comments when there are no findings", async () => {
    const createReview = vi.fn().mockResolvedValue({});
    const octokit = { rest: { pulls: { createReview } } } as never;

    await publishReview(octokit, snapshot, { summary: "Looks good.", findings: [] }, {
      owner: "owner",
      repo: "repo",
      pullNumber: 42,
      commitSha: "head-sha",
    });

    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
      event: "COMMENT",
      comments: [],
      body: expect.stringContaining("Looks good."),
    }));
  });
});
