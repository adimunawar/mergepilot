import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  previousFilename?: string;
  patch?: string;
  patchTruncated: boolean;
}

export interface PullRequestSnapshot {
  number: number;
  title: string;
  body: string;
  baseRef: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  totalChangedFiles: number;
  files: PullRequestFile[];
  filesTruncated: boolean;
  totalPatchCharacters: number;
}

export interface PullRequestCollectorOptions {
  maxFiles?: number;
  maxPatchCharactersPerFile?: number;
  maxTotalPatchCharacters?: number;
}

const DEFAULTS: Required<PullRequestCollectorOptions> = {
  maxFiles: 100,
  maxPatchCharactersPerFile: 20_000,
  maxTotalPatchCharacters: 100_000,
};

export async function collectPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  options: PullRequestCollectorOptions = {},
): Promise<PullRequestSnapshot> {
  const limits = { ...DEFAULTS, ...options };

  const [{ data: pullRequest }, allFiles] = await Promise.all([
    octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber }),
    octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    }),
  ]);

  const selectedFiles = allFiles.slice(0, limits.maxFiles);
  let totalPatchCharacters = 0;

  const files: PullRequestFile[] = selectedFiles.map((file) => {
    const rawPatch = file.patch;
    const remainingBudget = Math.max(
      0,
      limits.maxTotalPatchCharacters - totalPatchCharacters,
    );
    const allowedCharacters = Math.min(
      limits.maxPatchCharactersPerFile,
      remainingBudget,
    );
    const patch = rawPatch?.slice(0, allowedCharacters);
    const patchTruncated =
      rawPatch !== undefined && (patch?.length ?? 0) < rawPatch.length;

    totalPatchCharacters += patch?.length ?? 0;

    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      ...(file.previous_filename
        ? { previousFilename: file.previous_filename }
        : {}),
      ...(patch !== undefined ? { patch } : {}),
      patchTruncated,
    };
  });

  return {
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body ?? "",
    baseRef: pullRequest.base.ref,
    headRef: pullRequest.head.ref,
    baseSha: pullRequest.base.sha,
    headSha: pullRequest.head.sha,
    totalChangedFiles: allFiles.length,
    files,
    filesTruncated: allFiles.length > files.length,
    totalPatchCharacters,
  };
}
