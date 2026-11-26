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
    // Deleted lines do not advance the new-file line number.
  }
  return added;
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

    const addedLines = addedLineNumbers(file.patch);
    // Inline findings must start on an actual added line, not merely somewhere
    // inside a hunk that also contains unchanged context.
    if (!addedLines.has(finding.line)) continue;

    const key = `${finding.filePath}:${finding.line}:${finding.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push(finding);
  }

  return { summary: parsed.summary, findings };
}
