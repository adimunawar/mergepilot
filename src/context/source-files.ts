import * as github from "@actions/github";
import type { PullRequestSnapshot } from "../github/pull-request.js";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface SourceFileContext {
  filename: string;
  content: string;
  truncated: boolean;
}

export interface SourceFileCollection {
  files: SourceFileContext[];
  omittedFiles: string[];
  truncated: boolean;
}

export interface SourceFileCollectorOptions {
  maxFiles?: number;
  maxCharactersPerFile?: number;
  maxTotalCharacters?: number;
}

const DEFAULTS: Required<SourceFileCollectorOptions> = {
  maxFiles: 20,
  maxCharactersPerFile: 12_000,
  maxTotalCharacters: 60_000,
};

const SOURCE_EXTENSIONS = new Set([
  ".dart", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
  ".py", ".go", ".java", ".kt", ".kts", ".rs", ".rb", ".php", ".swift",
  ".cs", ".cpp", ".cc", ".c", ".h", ".hpp", ".scala", ".vue", ".svelte",
]);

const IGNORED_PATH_PARTS = [
  "/node_modules/", "/vendor/", "/build/", "/dist/", "/.dart_tool/",
  "/.next/", "/coverage/", "/generated/",
];

function isReviewableSource(filename: string): boolean {
  const normalized = `/${filename.replaceAll("\\", "/")}`;
  if (IGNORED_PATH_PARTS.some((part) => normalized.includes(part))) return false;
  if (/(^|\/)(\.g|\.freezed|\.mocks)\.(dart|ts|js)$/.test(filename)) return false;
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return SOURCE_EXTENSIONS.has(extension);
}

export async function collectSourceFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullRequest: PullRequestSnapshot,
  options: SourceFileCollectorOptions = {},
): Promise<SourceFileCollection> {
  const limits = { ...DEFAULTS, ...options };
  const files: SourceFileContext[] = [];
  const omittedFiles: string[] = [];
  let usedCharacters = 0;
  let truncated = false;

  const candidates = pullRequest.files.filter((file) =>
    file.status !== "removed" && isReviewableSource(file.filename),
  );

  for (const file of candidates) {
    if (files.length >= limits.maxFiles || usedCharacters >= limits.maxTotalCharacters) {
      omittedFiles.push(file.filename);
      truncated = true;
      continue;
    }

    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: pullRequest.headSha,
      });

      const data = response.data;
      if (Array.isArray(data) || data.type !== "file" || data.encoding !== "base64") {
        omittedFiles.push(file.filename);
        truncated = true;
        continue;
      }

      const decoded = Buffer.from(data.content, "base64").toString("utf8");
      if (decoded.includes("\0")) {
        omittedFiles.push(file.filename);
        truncated = true;
        continue;
      }

      const remaining = Math.max(0, limits.maxTotalCharacters - usedCharacters);
      const allowed = Math.min(limits.maxCharactersPerFile, remaining);
      const content = decoded.slice(0, allowed);
      const fileTruncated = content.length < decoded.length;

      files.push({ filename: file.filename, content, truncated: fileTruncated });
      usedCharacters += content.length;
      truncated ||= fileTruncated;
    } catch {
      // A source file may have been removed, exceed GitHub's content API limit,
      // or be unavailable due to repository permissions. Continue with other files.
      omittedFiles.push(file.filename);
      truncated = true;
    }
  }

  return { files, omittedFiles, truncated };
}
