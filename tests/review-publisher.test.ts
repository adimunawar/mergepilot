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

function createOctokit(existingReviews: unknown[] = [], existingComments: unknown[] = []) {
  const createReview = vi.fn().mockResolvedValue({});
  const createComment = vi.fn().mockResolvedValue({ data: { id: 99 } });
  const updateComment = vi.fn().mockResolvedValue({});
  const listReviews = vi.fn();
  const listComments = vi.fn();
  const paginate = vi.fn(async (method: unknown) =>
    method === listReviews ? existingReviews : existingComments
  );
  const graphql = vi.fn().mockResolvedValue({ repository: { pullRequest: { reviewThreads: { nodes: [] } } } });
  const octokit = {
    rest: {
      pulls: { createReview, listReviews },
      issues: { listComments, createComment, updateComment },
    },
    paginate,
    graphql,
  } as never;
  return { octokit, createReview, createComment, updateComment, listReviews, listComments, paginate, graphql };
}

const options = {
  owner: "owner",
  repo: "repo",
  pullNumber: 42,
  commitSha: "head-sha",
};

describe("publishReview", () => {
  it("creates one PR summary comment and posts inline findings in a review", async () => {
    const { octokit, createReview, createComment, paginate } = createOctokit();

    await publishReview(octokit, snapshot, review, options);

    expect(paginate).toHaveBeenCalledTimes(2);
    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({
      owner: "owner",
      repo: "repo",
      issue_number: 42,
      body: expect.stringContaining("One potential correctness issue."),
    }));
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

  it("updates the existing summary comment instead of creating another", async () => {
    const existingComments = [{
      id: 77,
      body: "Old summary <!-- mergepilot-summary -->",
      user: { type: "Bot" },
    }];
    const { octokit, createComment, updateComment } = createOctokit([], existingComments);

    await publishReview(octokit, snapshot, review, options);

    expect(createComment).not.toHaveBeenCalled();
    expect(updateComment).toHaveBeenCalledWith(expect.objectContaining({
      comment_id: 77,
      body: expect.stringContaining("One potential correctness issue."),
    }));
  });

  it("updates the summary but skips duplicate inline review for the same commit", async () => {
    const { octokit, createReview, createComment } = createOctokit([{
      commit_id: "head-sha",
      body: "<!-- mergepilot-review:head-sha -->",
    }]);

    await publishReview(octokit, snapshot, review, options);

    expect(createComment).toHaveBeenCalledOnce();
    expect(createReview).not.toHaveBeenCalled();
  });

  it("publishes a summary without inline comments when there are no findings", async () => {
    const { octokit, createReview, createComment } = createOctokit();

    await publishReview(octokit, snapshot, { summary: "Looks good.", findings: [] }, options);

    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining("Looks good."),
    }));
    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
      event: "COMMENT",
      comments: [],
    }));
  });

  it("limits inline comments to 50 and includes remaining findings in the summary", async () => {
    const { octokit, createReview, createComment } = createOctokit();
    const manyFindings: ReviewResult = {
      summary: "Many findings.",
      findings: Array.from({ length: 53 }, (_, index) => finding(index + 1)),
    };

    await publishReview(octokit, snapshot, manyFindings, options);

    const payload = createReview.mock.calls[0][0];
    expect(payload.comments).toHaveLength(50);
    expect(createComment.mock.calls[0][0].body).toContain("Additional findings (3");
    expect(createComment.mock.calls[0][0].body).toContain("src/app.ts:53");
  });
});
