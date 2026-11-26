import { describe, expect, it } from "vitest";
import { REVIEW_SYSTEM_INSTRUCTION } from "../src/review/gemini-reviewer.js";

describe("review system instructions", () => {
  it("requires full-file verification before reporting absence claims", () => {
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain(
      "latest PR-head source snapshot",
    );
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain(
      "Claims that something is missing",
    );
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain(
      "inspect the complete log message and all adjacent logging statements",
    );
  });

  it("requires current-source verification and non-stale suggestions", () => {
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain("latest PR-head source snapshot");
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain("before and after code snippets are identical");
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain("suggested correction");
  });

  it("requires concrete evidence and exact added-line anchors", () => {
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain(
      "triggering condition, concrete impact, and code evidence",
    );
    expect(REVIEW_SYSTEM_INSTRUCTION).toContain(
      "exact added line that contains the defect",
    );
  });
});
