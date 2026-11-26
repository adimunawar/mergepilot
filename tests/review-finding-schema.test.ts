import { describe, expect, it } from "vitest";
import { ReviewFindingSchema } from "../src/validators/finding-schema.js";

describe("ReviewFindingSchema", () => {
  it("accepts an evidence-based finding", () => {
    const result = ReviewFindingSchema.safeParse({
      title: "Handle a nullable response",
      body: "The response can be null before this property is accessed.",
      severity: "high",
      confidence: "high",
      path: "src/example.ts",
      line: 12,
      evidence: "The value is dereferenced without a null check.",
      suggestion: "Add a null guard.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unknown severity", () => {
    const result = ReviewFindingSchema.safeParse({
      title: "Issue",
      body: "Description",
      severity: "urgent",
      confidence: "high",
      path: "src/example.ts",
      line: 12,
      evidence: "Evidence",
    });

    expect(result.success).toBe(false);
  });
});
