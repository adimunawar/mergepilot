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
  evidence: z.string().min(1).max(2_000),
  suggestion: z.string().max(2_000),
  confidence: z.number().min(0).max(1),
}).strict();

const resultSchema = z.object({
  summary: z.string().max(2_000),
  findings: z.array(findingSchema).max(100),
}).strict();

const verificationSchema = z.object({
  summary: z.string().max(2_000),
  findings: z.array(z.object({
    candidateIndex: z.number().int().nonnegative(),
    verdict: z.enum(["confirm", "reject"]),
    evidence: z.string().max(2_000),
    reason: z.string().max(1_000),
  }).strict()).max(100),
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
  rejectedSuggestionAlreadyPresent: number;
  rejectedEvidenceNotInSource: number;
}

export interface ReviewSourceSnapshot {
  filename: string;
  content: string;
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

function normalizeCode(value: string): string {
  return value.replace(/\s+/g, "").replace(/;$/, "");
}

function suggestionIsAlreadyApplied(suggestion: string, source: string | undefined): boolean {
  if (!source || !suggestion.trim()) return false;
  const changePattern = /change\s+(['"`])([\s\S]*?)\1\s+to\s+(['"`])([\s\S]*?)\3/i;
  const match = changePattern.exec(suggestion);
  if (!match?.[2] || !match[4]) return false;
  const previous = normalizeCode(match[2]);
  const proposed = normalizeCode(match[4]);
  return Boolean(previous && previous === proposed && normalizeCode(source).includes(proposed));
}

export function validateReviewResultWithDiagnostics(
  value: unknown,
  pullRequest: PullRequestSnapshot,
  sourceSnapshots: ReviewSourceSnapshot[] = [],
): { result: ReviewResult; diagnostics: ReviewValidationDiagnostics } {
  const parsed = resultSchema.parse(value);
  const files = new Map(pullRequest.files.map((file) => [file.filename, file]));
  const sources = new Map(sourceSnapshots.map((file) => [file.filename, file.content]));
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
    rejectedSuggestionAlreadyPresent: 0,
    rejectedEvidenceNotInSource: 0,
  };

  for (const finding of parsed.findings) {
    const file = files.get(finding.filePath);
    if (!file) { diagnostics.rejectedUnknownFile += 1; continue; }
    if (file.patch === undefined) { diagnostics.rejectedMissingPatch += 1; continue; }
    if (file.status === "removed") { diagnostics.rejectedRemovedFile += 1; continue; }
    if (finding.endLine < finding.line || finding.endLine - finding.line > 20) {
      diagnostics.rejectedInvalidLineSpan += 1;
      continue;
    }
    if (!addedLineNumbers(file.patch).has(finding.line)) {
      diagnostics.rejectedNotAddedLine += 1;
      continue;
    }

    const source = sources.get(finding.filePath);
    if (source !== undefined && !source.includes(finding.evidence.trim())) {
      diagnostics.rejectedEvidenceNotInSource += 1;
      continue;
    }
    if (suggestionIsAlreadyApplied(finding.suggestion, source)) {
      diagnostics.rejectedSuggestionAlreadyPresent += 1;
      continue;
    }

    const key = `${finding.filePath}:${finding.line}:${finding.title.toLowerCase()}`;
    if (seen.has(key)) { diagnostics.rejectedDuplicate += 1; continue; }
    seen.add(key);
    findings.push(finding);
  }

  diagnostics.acceptedCount = findings.length;
  return { result: { summary: parsed.summary, findings }, diagnostics };
}

/**
 * Applies an independent semantic verification pass. A candidate is retained
 * only when the verifier confirms it and quotes text that exists verbatim in
 * the current PR-head source snapshot.
 */
export function validateReviewVerification(
  value: unknown,
  candidates: ReviewFinding[],
  sourceSnapshots: ReviewSourceSnapshot[],
): { findings: ReviewFinding[]; rejected: number } {
  const parsed = verificationSchema.parse(value);
  const sources = new Map(sourceSnapshots.map((file) => [file.filename, file.content]));
  const decisions = new Map(parsed.findings.map((decision) => [decision.candidateIndex, decision]));
  const findings: ReviewFinding[] = [];
  let rejected = 0;

  candidates.forEach((candidate, index) => {
    const decision = decisions.get(index);
    const source = sources.get(candidate.filePath);
    const quotedEvidence = decision?.evidence.trim();
    const originalEvidence = candidate.evidence.trim();
    const evidenceMatchesSource = Boolean(
      source && quotedEvidence && originalEvidence
      && source.includes(quotedEvidence)
      && source.includes(originalEvidence),
    );

    if (decision?.verdict === "confirm" && evidenceMatchesSource) {
      findings.push(candidate);
    } else {
      rejected += 1;
    }
  });

  return { findings, rejected };
}

export function validateReviewResult(value: unknown, pullRequest: PullRequestSnapshot): ReviewResult {
  return validateReviewResultWithDiagnostics(value, pullRequest).result;
}
