export const REVIEW_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export interface ReviewFinding {
  filePath: string;
  line: number;
  endLine: number;
  severity: ReviewSeverity;
  title: string;
  description: string;
  suggestion: string;
  confidence: number;
}

export interface ReviewResult {
  summary: string;
  findings: ReviewFinding[];
}
