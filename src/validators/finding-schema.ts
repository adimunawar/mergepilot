import { z } from "zod";

export const ReviewFindingSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(["critical", "high", "medium", "low"]),
  confidence: z.enum(["high", "medium", "low"]),
  path: z.string().min(1),
  line: z.number().int().positive(),
  evidence: z.string().min(1),
  suggestion: z.string().optional(),
});

export const ReviewResultSchema = z.object({
  summary: z.string(),
  findings: z.array(ReviewFindingSchema),
  reviewedCommitSha: z.string().min(1),
});
