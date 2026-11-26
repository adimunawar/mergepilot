import { describe, expect, it, vi } from "vitest";
import { collectSourceFiles } from "../src/context/source-files.js";
import type { PullRequestSnapshot } from "../src/github/pull-request.js";

const snapshot: PullRequestSnapshot = {
  number: 1,
  title: "Update feature",
  body: "",
  baseRef: "develop",
  headRef: "feature",
  baseSha: "base",
  headSha: "head-sha",
  totalChangedFiles: 3,
  files: [
    { filename: "lib/home.dart", status: "modified", additions: 1, deletions: 0, changes: 1, patch: "", patchTruncated: false },
    { filename: "package-lock.json", status: "modified", additions: 1, deletions: 0, changes: 1, patch: "", patchTruncated: false },
    { filename: "lib/removed.dart", status: "removed", additions: 0, deletions: 1, changes: 1, patch: "", patchTruncated: false },
  ],
  filesTruncated: false,
  totalPatchCharacters: 0,
};

function mockOctokit(content: string) {
  return {
    rest: {
      repos: {
        getContent: vi.fn().mockResolvedValue({
          data: {
            type: "file",
            encoding: "base64",
            content: Buffer.from(content, "utf8").toString("base64"),
          },
        }),
      },
    },
  } as never;
}

describe("collectSourceFiles", () => {
  it("fetches reviewable changed source at the exact PR head SHA", async () => {
    const octokit = mockOctokit("void main() {}") as { rest: { repos: { getContent: ReturnType<typeof vi.fn> } } };
    const result = await collectSourceFiles(octokit as never, "owner", "repo", snapshot);

    expect(result.files).toEqual([{ filename: "lib/home.dart", content: "void main() {}", truncated: false }]);
    expect(octokit.rest.repos.getContent).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      path: "lib/home.dart",
      ref: "head-sha",
    });
    expect(result.omittedFiles).toEqual([]);
  });

  it("applies per-file and total character bounds", async () => {
    const result = await collectSourceFiles(mockOctokit("x".repeat(100)), "owner", "repo", snapshot, {
      maxCharactersPerFile: 20,
      maxTotalCharacters: 15,
    });

    expect(result.files[0]?.content).toHaveLength(15);
    expect(result.files[0]?.truncated).toBe(true);
    expect(result.truncated).toBe(true);
  });

  it("omits files when GitHub cannot return their contents", async () => {
    const octokit = {
      rest: { repos: { getContent: vi.fn().mockRejectedValue(new Error("Not found")) } },
    } as never;
    const result = await collectSourceFiles(octokit, "owner", "repo", snapshot);

    expect(result.files).toEqual([]);
    expect(result.omittedFiles).toEqual(["lib/home.dart"]);
    expect(result.truncated).toBe(true);
  });
});
