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
    additions: 100,
    deletions: 0,
    changes: 100,
    patch: "@@ -1,0 +1,100 @@",
    patchTruncated: false,
  }],
  filesTruncated: false,
  totalPatchCharacters: 30,
};

const finding = (line: number) => ({
  filePath: "src/app.ts",
  line,
  endLine: line,
  severity: "high" as const,
  title: `Finding ${line}`,
  description: "The value is used without validation.",
  suggestion: "Validate the value before use.",
  confidence: 0.95,
});

const review: ReviewResult = {
  summary: "One potential correctness issue.",
  findings: [finding(1)],
};

function createOctokit(existingReviews: unknown[] = []) {
  const createReview = vi.fn().mockResolvedValue({});
  const listReviews = vi.fn();
  const paginate = vi.fn().mockResolvedValue(existingReviews);
  const octokit = {
    rest: { pulls: { createReview, listReviews } },
    paginate,
  } as never;
  return { octokit, createReview, listReviews, paginate };
}

const options = {
  owner: "owner",
  repo: "repo",
  pullNumber: 42,
  commitSha: "head-sha",
};

describe("publishReview", () => {
  it("posts a COMMENT review anchored to the PR head commit", async () => {
    const { octokit, createReview, paginate } = createOctokit();

    await publishReview(octokit, snapshot, review, options);

    expect(paginate).toHaveBeenCalled();
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
        body: expect.stringContaining("[HIGH] Finding 1"),
      }],
      body: expect.stringContaining("mergepilot-review:head-sha"),
    }));
  });

  it("publishes a summary without inline comments when there are no findings", async () => {
    const { octokit, createReview } = createOctokit();

    await publishReview(octokit, snapshot, { summary: "Looks good.", findings: [] }, options);

    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
      event: "COMMENT",
      comments: [],
      body: expect.stringContaining("Looks good."),
    }));
  });

  it("skips publishing when this commit already has a MergePilot review", async () => {
    const { octokit, createReview } = createOctokit([{
      commit_id: "head-sha",
      body: "<!-- mergepilot-review:head-sha -->",
    }]);

    await publishReview(octokit, snapshot, review, options);

    expect(createReview).not.toHaveBeenCalled();
  });

  it("limits inline comments to 50 and includes remaining findings in the summary", async () => {
    const { octokit, createReview } = createOctokit();
    const manyFindings: ReviewResult = {
      summary: "Many findings.",
      findings: Array.from({ length: 53 }, (_, index) => finding(index + 1)),
    };

    await publishReview(octokit, snapshot, manyFindings, options);

    const payload = createReview.mock.calls[0][0];
    expect(payload.comments).toHaveLength(50);
    expect(payload.body).toContain("Additional findings (3");
    expect(payload.body).toContain("src/app.ts:53");
  });
});
