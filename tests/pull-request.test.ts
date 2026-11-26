import { describe, expect, it } from "vitest";
import { collectPullRequest } from "../src/github/pull-request.js";

function createOctokitMock() {
  const pullRequest = {
    number: 42,
    title: "Add profile screen",
    body: null,
    base: { ref: "develop", sha: "base-sha" },
    head: { ref: "feat/profile", sha: "head-sha" },
  };

  const files = [
    {
      filename: "lib/profile.dart",
      status: "modified",
      additions: 12,
      deletions: 3,
      changes: 15,
      patch: "@@ -1 +1 @@\n-old\n+new",
    },
    {
      filename: "test/profile_test.dart",
      status: "added",
      additions: 20,
      deletions: 0,
      changes: 20,
    },
  ];

  const octokit = {
    rest: {
      pulls: {
        get: async () => ({ data: pullRequest }),
        listFiles: async () => ({ data: files }),
      },
    },
    paginate: async () => files,
  };

  return octokit;
}

describe("collectPullRequest", () => {
  it("collects PR metadata and changed files without requiring patches", async () => {
    const result = await collectPullRequest(
      createOctokitMock() as never,
      "owner",
      "repo",
      42,
    );

    expect(result.number).toBe(42);
    expect(result.title).toBe("Add profile screen");
    expect(result.body).toBe("");
    expect(result.baseSha).toBe("base-sha");
    expect(result.headSha).toBe("head-sha");
    expect(result.totalChangedFiles).toBe(2);
    expect(result.files).toHaveLength(2);
    expect(result.files[1]?.patch).toBeUndefined();
  });

  it("bounds the number of files and total patch characters", async () => {
    const result = await collectPullRequest(
      createOctokitMock() as never,
      "owner",
      "repo",
      42,
      { maxFiles: 1, maxTotalPatchCharacters: 5 },
    );

    expect(result.files).toHaveLength(1);
    expect(result.filesTruncated).toBe(true);
    expect(result.files[0]?.patch).toHaveLength(5);
    expect(result.files[0]?.patchTruncated).toBe(true);
    expect(result.totalPatchCharacters).toBe(5);
  });
});
