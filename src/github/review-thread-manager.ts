import { createHash } from "node:crypto";
import type * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;

interface ReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  comments: { nodes: Array<{ body: string; author: { login: string } | null }> };
}

interface ReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: { nodes: ReviewThread[] };
    } | null;
  } | null;
}

export function createFindingKey(finding: {
  filePath: string;
  title: string;
}): string {
  const normalizedTitle = finding.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha256")
    .update(`${finding.filePath.toLowerCase()}::${normalizedTitle}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Resolve only MergePilot-owned threads that GitHub marks outdated and that
 * the latest review no longer reports. Current or uncertain threads stay open.
 */
export async function resolveOutdatedMergePilotThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  currentFindings: Array<{ filePath: string; title: string }>,
): Promise<number> {
  const response = await octokit.graphql<ReviewThreadsResponse>(
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              isOutdated
              comments(first: 20) {
                nodes {
                  body
                  author { login }
                }
              }
            }
          }
        }
      }
    }`,
    { owner, name: repo, number: pullNumber },
  );

  const threads = response.repository?.pullRequest?.reviewThreads.nodes ?? [];
  const currentKeys = new Set(currentFindings.map(createFindingKey));
  let resolvedCount = 0;

  for (const thread of threads) {
    if (thread.isResolved || !thread.isOutdated) continue;

    const mergePilotFinding = thread.comments.nodes.find((comment) =>
      comment.body.includes("<!-- mergepilot-finding:"),
    );
    if (!mergePilotFinding) continue;

    const match = /<!-- mergepilot-finding:([a-f0-9]{16}) -->/.exec(mergePilotFinding.body);
    if (!match || currentKeys.has(match[1])) continue;

    await octokit.graphql(
      `mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { id isResolved }
        }
      }`,
      { threadId: thread.id },
    );
    resolvedCount += 1;
  }

  return resolvedCount;
}
