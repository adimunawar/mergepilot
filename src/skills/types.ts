export interface SkillDefinition {
  id: string;
  path: string;
  description: string;
}

export interface LanguageSkillMapping {
  extensions: string[];
  skills: string[];
}

export interface SkillRegistry {
  version: number;
  defaultSkills: string[];
  languages: Record<string, LanguageSkillMapping>;
}

export interface LoadedSkill extends SkillDefinition {
  content: string;
  source: "default" | "language";
  language?: string;
}

export interface SkillLoadResult {
  skills: LoadedSkill[];
  detectedLanguages: string[];
  unmatchedFiles: string[];
}
