import { describe, expect, it } from "vitest";
import { buildReviewContext } from "../src/context/context-builder.js";
import type { PullRequestSnapshot } from "../src/github/pull-request.js";
import type { SkillLoadResult } from "../src/skills/types.js";

const pullRequest: PullRequestSnapshot = {
  number: 7,
  title: "Update checkout",
  body: "Please review this change.",
  baseRef: "develop",
  headRef: "feature/checkout",
  baseSha: "base",
  headSha: "head",
  totalChangedFiles: 2,
  files: [
    {
      filename: "src/checkout.ts",
      status: "modified",
      additions: 4,
      deletions: 1,
      changes: 5,
      patch: "@@ -1 +1 @@\n-old\n+new",
      patchTruncated: false,
    },
    {
      filename: "README.md",
      status: "modified",
      additions: 1,
      deletions: 0,
      changes: 1,
      patch: "@@ -1 +1 @@\n-old\n+new",
      patchTruncated: false,
    },
  ],
  filesTruncated: false,
  totalPatchCharacters: 30,
};

const skills: SkillLoadResult = {
  detectedLanguages: ["typescript"],
  unmatchedFiles: ["README.md"],
  skills: [{
    id: "typescript-review",
    path: "languages/typescript/SKILL.md",
    description: "TypeScript review",
    content: "# TypeScript Review\nCheck runtime validation.",
    source: "language",
    language: "typescript",
  }],
};

describe("buildReviewContext", () => {
  it("combines metadata, skills, and changed patches as untrusted data", () => {
    const result = buildReviewContext({ pullRequest, skills });

    expect(result.prompt).toContain("## Pull request metadata");
    expect(result.prompt).toContain("Review skill: typescript-review");
    expect(result.prompt).toContain('<untrusted-input label="diff:src/checkout.ts">');
    expect(result.includedFiles).toEqual(["src/checkout.ts", "README.md"]);
    expect(result.includedSkills).toEqual(["typescript-review"]);
    expect(result.truncated).toBe(false);
  });

  it("respects the total character budget and reports omitted files", () => {
    const result = buildReviewContext(
      { pullRequest, skills },
      { maxTotalCharacters: 1_000, maxSkillCharacters: 100 },
    );

    expect(result.characterCount).toBeLessThanOrEqual(1_000);
    expect(result.truncated).toBe(true);
  });

  it("clips oversized skills and marks the context as truncated", () => {
    const result = buildReviewContext(
      { pullRequest, skills: { ...skills, skills: [{
        ...skills.skills[0]!,
        content: "x".repeat(500),
      }] } },
      { maxSkillCharacters: 20 },
    );

    expect(result.prompt).toContain("[TRUNCATED BY MERGEPILOT]");
    expect(result.truncated).toBe(true);
  });
});
