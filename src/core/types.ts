export type Severity = "critical" | "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";

export interface ReviewFinding {
  title: string;
  body: string;
  severity: Severity;
  confidence: Confidence;
  path: string;
  line: number;
  evidence: string;
  suggestion?: string;
}

export interface ReviewResult {
  summary: string;
  findings: ReviewFinding[];
  reviewedCommitSha: string;
}
