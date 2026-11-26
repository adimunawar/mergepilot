import { describe, expect, it } from "vitest";
import { validateReviewResult, validateReviewResultWithDiagnostics, validateReviewVerification } from "../src/review/validator.js";
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
  evidence: "const added = false;",
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


  it("rejects a stale change-to-identical-code suggestion already present in the current source", () => {
    const currentSource = [
      "export function applyDiscount(price: number, discountPercent: number): number {",
      "  return price - (price * discountPercent) / 100;",
      "}",
    ].join("\n");
    const staleFinding = {
      filePath: "src/app.ts",
      line: 11,
      endLine: 11,
      severity: "critical",
      title: "Arithmetic direction bug",
      description: "The function adds the discount instead of subtracting it.",
      evidence: "return price - (price * discountPercent) / 100;",
      suggestion: "Change 'return price - (price * discountPercent) / 100;' to 'return price - (price * discountPercent) / 100;'",
      confidence: 1,
    };
    const { result, diagnostics } = validateReviewResultWithDiagnostics({
      summary: "Review complete",
      findings: [staleFinding],
    }, pullRequest, [{ filename: "src/app.ts", content: currentSource }]);

    expect(result.findings).toHaveLength(0);
    expect(diagnostics).toMatchObject({
      candidateCount: 1,
      acceptedCount: 0,
      rejectedSuggestionAlreadyPresent: 1,
    });
  });

  it("keeps findings when the suggested replacement is not already present", () => {
    const { result, diagnostics } = validateReviewResultWithDiagnostics({
      summary: "Review complete",
      findings: [{
        ...finding(11),
        suggestion: "Change 'const added = false;' to 'const added = true;'",
      }],
    }, pullRequest, [{ filename: "src/app.ts", content: "const added = false;" }]);

    expect(result.findings).toHaveLength(1);
    expect(diagnostics.rejectedSuggestionAlreadyPresent).toBe(0);
  });


  it("rejects a semantically false arithmetic finding even when its evidence quote exists", async () => {
    const candidate = {
      filePath: "src/app.ts",
      line: 11,
      endLine: 11,
      severity: "critical" as const,
      title: "Arithmetic direction bug",
      description: "The function adds the discount instead of subtracting it.",
      evidence: "return price - (price * discountPercent) / 100;",
      suggestion: "Subtract the discount from the original price.",
      confidence: 1,
    };
    const sourceSnapshots = [{
      filename: "src/app.ts",
      content: [
        "export function applyDiscount(price: number, discountPercent: number): number {",
        "  return price - (price * discountPercent) / 100;",
        "}",
      ].join("\\n"),
    }];
    const { findings, rejected } = validateReviewVerification({
      summary: "The claim contradicts the current implementation.",
      findings: [{
        candidateIndex: 0,
        verdict: "reject",
        evidence: "return price - (price * discountPercent) / 100;",
        reason: "The current source subtracts the discount; it does not add it.",
      }],
    }, [candidate], sourceSnapshots);

    expect(findings).toHaveLength(0);
    expect(rejected).toBe(1);
  });

  it("fails closed when the verifier's evidence is not an exact source excerpt", () => {
    const candidate = { ...finding(11), evidence: "const added = false;" };
    const { findings, rejected } = validateReviewVerification({
      summary: "Verification complete.",
      findings: [{
        candidateIndex: 0,
        verdict: "confirm",
        evidence: "const added = true;",
        reason: "Claimed evidence does not match the file.",
      }],
    }, [candidate], [{ filename: "src/app.ts", content: "const added = false;" }]);

    expect(findings).toHaveLength(0);
    expect(rejected).toBe(1);
  });

  it("rejects malformed model output", () => {
    expect(() => validateReviewResult({ findings: "not-an-array" }, pullRequest)).toThrow();
  });
});
