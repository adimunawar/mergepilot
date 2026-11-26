import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
    constructor(_options: { apiKey: string }) {}
  },
}));

import { buildReviewContext } from "../../src/context/context-builder.js";
import type { PullRequestSnapshot } from "../../src/github/pull-request.js";
import { publishReview } from "../../src/github/review-publisher.js";
import { reviewPullRequest } from "../../src/review/gemini-reviewer.js";
import type { SkillLoadResult } from "../../src/skills/types.js";

const pullRequest: PullRequestSnapshot = {
  number: 17,
  title: "Add checkout validation",
  body: "Please review the validation change.",
  baseRef: "develop",
  headRef: "feature/checkout-validation",
  baseSha: "base-sha",
  headSha: "head-sha",
  totalChangedFiles: 1,
  files: [{
    filename: "src/checkout.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: "@@ -1 +1 @@\n-const valid = true;\n+const valid = input.length > 0;",
    patchTruncated: false,
  }],
  filesTruncated: false,
  totalPatchCharacters: 65,
};

const skills: SkillLoadResult = {
  detectedLanguages: ["typescript"],
  unmatchedFiles: [],
  skills: [{
    id: "code-quality",
    path: "shared/code-quality/SKILL.md",
    description: "General code quality review",
    content: "Check correctness and concrete regressions.",
    source: "default",
  }],
};

const modelResponse = {
  summary: "The new validation may throw for a null input.",
  findings: [
    {
      filePath: "src/checkout.ts",
      line: 1,
      endLine: 1,
      severity: "high",
      title: "Null input is not handled",
      description: "Accessing length throws when input is null.",
      suggestion: "Guard against null before reading length.",
      confidence: 0.96,
    },
    {
      filePath: "src/checkout.ts",
      line: 2,
      endLine: 2,
      severity: "medium",
      title: "Unchanged line finding",
      description: "This line is not part of the patch.",
      suggestion: "",
      confidence: 0.9,
    },
  ],
};

describe("end-to-end review pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateContent.mockResolvedValue({
      text: "Here is the review result:\n\n```json\n" + JSON.stringify(modelResponse) + "\n```",
    });
  });

  it("builds bounded context, validates Gemini output, and publishes only an anchored finding", async () => {
    const context = buildReviewContext({ pullRequest, skills });
    const review = await reviewPullRequest(context, pullRequest, {
      apiKey: "test-api-key",
      model: "gemini-test-model",
    });

    const createReview = vi.fn().mockResolvedValue({});
    const createComment = vi.fn().mockResolvedValue({});
    const updateComment = vi.fn().mockResolvedValue({});
    const listReviews = vi.fn();
    const listComments = vi.fn();
    const paginate = vi.fn().mockResolvedValue([]);
    const octokit = {
      rest: {
        pulls: { createReview, listReviews },
        issues: { listComments, createComment, updateComment },
      },
      paginate,
      graphql: vi.fn().mockResolvedValue({ repository: { pullRequest: { reviewThreads: { nodes: [] } } } }),
    } as never;

    await publishReview(octokit, pullRequest, review, {
      owner: "acme",
      repo: "checkout",
      pullNumber: pullRequest.number,
      commitSha: pullRequest.headSha,
    });

    expect(generateContent).toHaveBeenCalledOnce();
    const request = generateContent.mock.calls[0]?.[0];
    expect(request.contents).toContain(context.prompt);
    expect(request.contents).toContain("untrusted-input");
    expect(request.config.systemInstruction).toContain("Act on, Consider, Noted, or Dismissed");
    expect(request.config.systemInstruction).toContain("triggering condition, concrete impact, and code evidence");
    expect(request.config.systemInstruction).toContain("Do not report a missing test alone as a defect.");

    expect(review.findings).toHaveLength(1);
    expect(review.findings[0]?.line).toBe(1);
    expect(paginate).toHaveBeenCalledOnce();
    expect(createComment).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.stringContaining("MergePilot — Code Review"),
    }));
    expect(createReview).toHaveBeenCalledWith(expect.objectContaining({
      owner: "acme",
      repo: "checkout",
      pull_number: 17,
      commit_id: "head-sha",
      event: "COMMENT",
      comments: [
        expect.objectContaining({
          path: "src/checkout.ts",
          line: 1,
          side: "RIGHT",
          body: expect.stringContaining("Null input is not handled"),
        }),
      ],
      body: expect.stringContaining("mergepilot-review:head-sha"),
    }));
  });

  it("extracts the final review JSON when the model prepends reasoning or commentary", async () => {
    generateContent.mockResolvedValueOnce({
      text: [
        "Now we need to inspect the diff carefully. Example object: {not valid JSON}.",
        "The review result is:",
        JSON.stringify({ summary: "No actionable issues found.", findings: [] }),
      ].join("\n"),
    });

    const review = await reviewPullRequest(
      buildReviewContext({ pullRequest, skills }),
      pullRequest,
      { provider: "gemini", apiKey: "test-api-key", model: "gemini-test-model" },
    );

    expect(review).toEqual({
      summary: "No actionable issues found.",
      findings: [],
    });
  });

  it("fails closed when Gemini returns malformed JSON and does not publish a review", async () => {
    generateContent.mockResolvedValueOnce({ text: "{not-json" });

    await expect(reviewPullRequest(
      buildReviewContext({ pullRequest, skills }),
      pullRequest,
      { provider: "gemini", apiKey: "test-api-key", model: "gemini-test-model" },
    )).rejects.toThrow("invalid JSON");
  });
});
