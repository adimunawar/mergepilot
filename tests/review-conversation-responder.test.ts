import { describe, expect, it, vi } from "vitest";
import { respondToReviewConversation } from "../src/review/conversation-responder.js";
import type { AIProvider } from "../src/providers/types.js";

describe("respondToReviewConversation", () => {
  it("returns a validated, evidence-based thread response", async () => {
    const generateReview = vi.fn().mockResolvedValue(JSON.stringify({
      disposition: "reconsider",
      reply: "Thanks for the context. Given the caller validation, this finding does not apply here.",
    }));
    const provider = { generateReview } as unknown as AIProvider;

    const result = await respondToReviewConversation(provider, "test-model", {
      pullRequestTitle: "Add account lookup",
      pullRequestBody: "Adds account lookup.",
      changedFiles: ["src/account.ts"],
      diffs: [{ filename: "src/account.ts", patch: "@@ -1 +1 @@\n-const id = input;\n+return lookup(id);" }],
      comments: [
        { id: 1, author: "github-actions[bot]", body: "The value may be null." },
        { id: 2, author: "developer", body: "The caller validates it before this function." },
      ],
    });

    expect(result.disposition).toBe("reconsider");
    expect(result.reply).toContain("caller validation");
    expect(generateReview).toHaveBeenCalledWith(expect.objectContaining({
      model: "test-model",
      prompt: expect.stringContaining("caller validates it"),
    }));
  });

  it("rejects malformed model output", async () => {
    const provider = {
      generateReview: vi.fn().mockResolvedValue("not json"),
    } as unknown as AIProvider;

    await expect(respondToReviewConversation(provider, "test-model", {
      pullRequestTitle: "Title",
      pullRequestBody: "",
      changedFiles: [],
      diffs: [],
      comments: [],
    })).rejects.toThrow("invalid JSON");
  });
});
