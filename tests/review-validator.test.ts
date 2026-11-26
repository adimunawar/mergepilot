import { describe, expect, it } from "vitest";
import { validateReviewResult, validateReviewResultWithDiagnostics } from "../src/review/validator.js";
import type { PullRequestSnapshot } from "../src/github/pull-request.js";

const pullRequest: PullRequestSnapshot = {
  number: 1,
  title: "Add feature",
  body: "",
  baseRef: "develop",
  headRef: "feature",
  baseSha: "base",
  headSha: "head",
  totalChangedFiles: 1,
  files: [{
    filename: "src/app.ts",
    status: "modified",
    additions: 2,
    deletions: 1,
    changes: 3,
    patch: "@@ -10,3 +10,4 @@\n const before = true;\n+const added = false;\n const after = true;\n+run(added);",
    patchTruncated: false,
  }],
  filesTruncated: false,
  totalPatchCharacters: 90,
};

const finding = (line: number, title = "Possible defect") => ({
  filePath: "src/app.ts",
  line,
  endLine: line,
  severity: "high",
  title,
  description: "A concrete issue.",
  suggestion: "Handle this case.",
  confidence: 0.9,
});

describe("validateReviewResult", () => {
  it("keeps findings anchored to added lines only", () => {
    const result = validateReviewResult({
      summary: "Review complete",
      findings: [finding(10), finding(11), finding(13)],
    }, pullRequest);

    expect(result.findings.map((item) => item.line)).toEqual([11, 13]);
  });

  it("drops unknown files, duplicates, and invalid line spans", () => {
    const result = validateReviewResult({
      summary: "Review complete",
      findings: [
        finding(11),
        finding(11),
        { ...finding(11), filePath: "unknown.ts" },
        { ...finding(11), endLine: 40 },
      ],
    }, pullRequest);

    expect(result.findings).toHaveLength(1);
  });

  it("reports why model candidates were rejected", () => {
    const { result, diagnostics } = validateReviewResultWithDiagnostics({
      summary: "Review complete",
      findings: [
        finding(11),
        { ...finding(10), title: "Context line" },
        { ...finding(11), filePath: "missing.ts" },
      ],
    }, pullRequest);

    expect(result.findings).toHaveLength(1);
    expect(diagnostics).toMatchObject({
      candidateCount: 3,
      acceptedCount: 1,
      rejectedNotAddedLine: 1,
      rejectedUnknownFile: 1,
    });
  });

  it("rejects malformed model output", () => {
    expect(() => validateReviewResult({ findings: "not-an-array" }, pullRequest)).toThrow();
  });
});
