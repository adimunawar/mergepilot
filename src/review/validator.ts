import { z } from "zod";
import type { PullRequestSnapshot } from "../github/pull-request.js";
import type { ReviewFinding, ReviewResult } from "./types.js";

const findingSchema = z.object({
  filePath: z.string().min(1).max(500),
  line: z.number().int().positive(),
  endLine: z.number().int().positive(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1).max(160),
  description: z.string().min(1).max(2_000),
  suggestion: z.string().max(2_000),
  confidence: z.number().min(0).max(1),
}).strict();

const resultSchema = z.object({
  summary: z.string().max(2_000),
  findings: z.array(findingSchema).max(100),
}).strict();

export interface ReviewValidationDiagnostics {
  candidateCount: number;
  acceptedCount: number;
  rejectedUnknownFile: number;
  rejectedMissingPatch: number;
  rejectedRemovedFile: number;
  rejectedInvalidLineSpan: number;
  rejectedNotAddedLine: number;
  rejectedDuplicate: number;
}

function addedLineNumbers(patch: string): Set<number> {
  const added = new Set<number>();
  let newLine = 0;
  for (const line of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+++")) continue;
    if (line.startsWith("+")) {
      added.add(newLine);
      newLine += 1;
    } else if (line.startsWith(" ")) {
      newLine += 1;
    }
  }
  return added;
}

export function validateReviewResultWithDiagnostics(
  value: unknown,
  pullRequest: PullRequestSnapshot,
): { result: ReviewResult; diagnostics: ReviewValidationDiagnostics } {
  const parsed = resultSchema.parse(value);
  const files = new Map(pullRequest.files.map((file) => [file.filename, file]));
  const seen = new Set<string>();
  const findings: ReviewFinding[] = [];
  const diagnostics: ReviewValidationDiagnostics = {
    candidateCount: parsed.findings.length,
    acceptedCount: 0,
    rejectedUnknownFile: 0,
    rejectedMissingPatch: 0,
    rejectedRemovedFile: 0,
    rejectedInvalidLineSpan: 0,
    rejectedNotAddedLine: 0,
    rejectedDuplicate: 0,
  };

  for (const finding of parsed.findings) {
    const file = files.get(finding.filePath);
    if (!file) {
      diagnostics.rejectedUnknownFile += 1;
      continue;
    }
    if (file.patch === undefined) {
      diagnostics.rejectedMissingPatch += 1;
      continue;
    }
    if (file.status === "removed") {
      diagnostics.rejectedRemovedFile += 1;
      continue;
    }
    if (finding.endLine < finding.line || finding.endLine - finding.line > 20) {
      diagnostics.rejectedInvalidLineSpan += 1;
      continue;
    }

    const addedLines = addedLineNumbers(file.patch);
    if (!addedLines.has(finding.line)) {
      diagnostics.rejectedNotAddedLine += 1;
      continue;
    }

    const key = `${finding.filePath}:${finding.line}:${finding.title.toLowerCase()}`;
    if (seen.has(key)) {
      diagnostics.rejectedDuplicate += 1;
      continue;
    }
    seen.add(key);
    findings.push(finding);
  }

  diagnostics.acceptedCount = findings.length;
  return {
    result: { summary: parsed.summary, findings },
    diagnostics,
  };
}

export function validateReviewResult(
  value: unknown,
  pullRequest: PullRequestSnapshot,
): ReviewResult {
  return validateReviewResultWithDiagnostics(value, pullRequest).result;
}
