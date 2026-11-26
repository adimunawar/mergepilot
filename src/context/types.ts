import type { PullRequestSnapshot } from "../github/pull-request.js";
import type { SkillLoadResult } from "../skills/types.js";

export interface ReviewContextOptions {
  maxTotalCharacters?: number;
  maxPatchCharactersPerFile?: number;
  maxSkillCharacters?: number;
}

export interface ReviewContext {
  prompt: string;
  characterCount: number;
  includedFiles: string[];
  omittedFiles: string[];
  includedSkills: string[];
  truncated: boolean;
}

export interface ReviewContextInput {
  pullRequest: PullRequestSnapshot;
  skills: SkillLoadResult;
  repositoryInstructions?: string;
}
