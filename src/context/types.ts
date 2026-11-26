import type { PullRequestSnapshot } from "../github/pull-request.js";
import type { SkillLoadResult } from "../skills/types.js";
import type { SourceFileCollection } from "./source-files.js";

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
  includedSourceFiles: string[];
  omittedSourceFiles: string[];
  includedSkills: string[];
  truncated: boolean;
}

export interface ReviewContextInput {
  pullRequest: PullRequestSnapshot;
  skills: SkillLoadResult;
  sourceFiles?: SourceFileCollection;
  repositoryInstructions?: string;
}
