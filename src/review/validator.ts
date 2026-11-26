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

function changedLineRanges(patch: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let current: { start: number; end: number } | undefined;
  for (const line of patch.split("\n")) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (match) {
      if (current) ranges.push(current);
      const start = Number(match[1]);
      const count = match[2] === undefined ? 1 : Number(match[2]);
      current = count > 0 ? { start, end: start + count - 1 } : undefined;
      continue;
    }
    if (current && line.startsWith("+") && !line.startsWith("+++")) {
      // The range header is the complete new-side hunk range; added lines
      // are checked against that range below.
    }
  }
  if (current) ranges.push(current);
  return ranges;
}

export function validateReviewResult(
  value: unknown,
  pullRequest: PullRequestSnapshot,
): ReviewResult {
  const parsed = resultSchema.parse(value);
  const files = new Map(pullRequest.files.map((file) => [file.filename, file]));
  const seen = new Set<string>();
  const findings: ReviewFinding[] = [];

  for (const finding of parsed.findings) {
    const file = files.get(finding.filePath);
    if (!file || file.patch === undefined || file.status === "removed") continue;
    if (finding.endLine < finding.line || finding.endLine - finding.line > 20) continue;

    const ranges = changedLineRanges(file.patch);
    const overlapsChangedHunk = ranges.some((range) =>
      finding.line <= range.end && finding.endLine >= range.start,
    );
    if (!overlapsChangedHunk) continue;

    const key = `${finding.filePath}:${finding.line}:${finding.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(finding);
  }

  return { summary: parsed.summary, findings };
}
