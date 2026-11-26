import { describe, expect, it, vi } from "vitest";
import { createFindingKey, resolveOutdatedMergePilotThreads } from "../src/github/review-thread-manager.js";

describe("review thread resolution", () => {
  it("resolves only outdated MergePilot threads absent from the latest findings", async () => {
    const staleKey = createFindingKey({ filePath: "src/app.ts", title: "Old null guard" });
    const currentKey = createFindingKey({ filePath: "src/app.ts", title: "Current validation bug" });
    const graphql = vi.fn()
      .mockResolvedValueOnce({
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                {
                  id: "thread-stale",
                  isResolved: false,
                  isOutdated: true,
                  comments: { nodes: [{ body: `Old finding <!-- mergepilot-finding:${staleKey} -->`, author: { login: "mergepilot[bot]" } }] },
                },
                {
                  id: "thread-current",
                  isResolved: false,
                  isOutdated: true,
                  comments: { nodes: [{ body: `Current finding <!-- mergepilot-finding:${currentKey} -->`, author: { login: "mergepilot[bot]" } }] },
                },
                {
                  id: "human-thread",
                  isResolved: false,
                  isOutdated: true,
                  comments: { nodes: [{ body: "Human reviewer comment", author: { login: "reviewer" } }] },
                },
                {
                  id: "not-outdated",
                  isResolved: false,
                  isOutdated: false,
                  comments: { nodes: [{ body: `Still current <!-- mergepilot-finding:${staleKey} -->`, author: { login: "mergepilot[bot]" } }] },
                },
              ],
            },
          },
        },
      })
      .mockResolvedValueOnce({ resolveReviewThread: { thread: { id: "thread-stale", isResolved: true } } });
    const octokit = { graphql } as never;

    const resolved = await resolveOutdatedMergePilotThreads(
      octokit,
      "owner",
      "repo",
      42,
      [{ filePath: "src/app.ts", title: "Current validation bug" }],
    );

    expect(resolved).toBe(1);
    expect(graphql).toHaveBeenCalledTimes(2);
    expect(graphql.mock.calls[1]?.[1]).toEqual({ threadId: "thread-stale" });
  });

  it("does not resolve anything when GitHub has no review threads", async () => {
    const graphql = vi.fn().mockResolvedValue({
      repository: { pullRequest: { reviewThreads: { nodes: [] } } },
    });

    await expect(resolveOutdatedMergePilotThreads(
      { graphql } as never,
      "owner",
      "repo",
      42,
      [],
    )).resolves.toBe(0);
    expect(graphql).toHaveBeenCalledOnce();
  });
});
