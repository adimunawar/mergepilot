import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  LanguageSkillMapping,
  LoadedSkill,
  SkillDefinition,
  SkillLoadResult,
  SkillRegistry,
} from "./types.js";

const MAX_SKILL_BYTES = 64 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRegistry(value: unknown): SkillRegistry {
  if (!isRecord(value)) throw new Error("Skill registry must be an object.");
  if (value.version !== 1) throw new Error("Unsupported skill registry version.");
  if (!Array.isArray(value.defaultSkills) || !isRecord(value.languages)) {
    throw new Error("Skill registry is missing defaultSkills or languages.");
  }

  const languages: Record<string, LanguageSkillMapping> = {};
  for (const [language, rawMapping] of Object.entries(value.languages)) {
    if (!isRecord(rawMapping) ||
        !Array.isArray(rawMapping.extensions) ||
        !Array.isArray(rawMapping.skills) ||
        !rawMapping.extensions.every((item) => typeof item === "string") ||
        !rawMapping.skills.every((item) => typeof item === "string")) {
      throw new Error(`Invalid skill mapping for language: ${language}`);
    }
    languages[language] = {
      extensions: rawMapping.extensions,
      skills: rawMapping.skills,
    };
  }

  if (!value.defaultSkills.every((item) => typeof item === "string")) {
    throw new Error("defaultSkills must contain only skill IDs.");
  }

  return {
    version: 1,
    defaultSkills: value.defaultSkills,
    languages,
  };
}

function parseSkillDefinition(skillId: string, raw: unknown): SkillDefinition {
  if (!isRecord(raw) ||
      typeof raw.path !== "string" ||
      typeof raw.description !== "string") {
    throw new Error(`Invalid skill definition: ${skillId}`);
  }
  return { id: skillId, path: raw.path, description: raw.description };
}

function detectLanguages(
  filenames: string[],
  languages: Record<string, LanguageSkillMapping>,
): { detectedLanguages: string[]; unmatchedFiles: string[] } {
  const detected = new Set<string>();
  const unmatchedFiles: string[] = [];

  for (const filename of filenames) {
    const extension = path.extname(filename).toLowerCase();
    const matches = Object.entries(languages)
      .filter(([, mapping]) =>
        mapping.extensions.some((item) => item.toLowerCase() === extension),
      )
      .map(([language]) => language);

    if (matches.length === 0) unmatchedFiles.push(filename);
    for (const language of matches) detected.add(language);
  }

  return {
    detectedLanguages: [...detected].sort(),
    unmatchedFiles,
  };
}

async function loadSkill(
  skillsRoot: string,
  skillId: string,
  source: LoadedSkill["source"],
  language?: string,
): Promise<LoadedSkill> {
  const manifestPath = path.resolve(skillsRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  if (!isRecord(manifest) || !isRecord(manifest.skills)) {
    throw new Error("Skill manifest must contain a skills object.");
  }

  const definition = parseSkillDefinition(skillId, manifest.skills[skillId]);
  const skillPath = path.resolve(skillsRoot, definition.path);
  const rootPrefix = path.resolve(skillsRoot) + path.sep;
  if (!skillPath.startsWith(rootPrefix)) {
    throw new Error(`Skill path escapes skills directory: ${skillId}`);
  }

  const content = await readFile(skillPath, "utf8");
  if (Buffer.byteLength(content, "utf8") > MAX_SKILL_BYTES) {
    throw new Error(`Skill exceeds the ${MAX_SKILL_BYTES}-byte limit: ${skillId}`);
  }

  return {
    ...definition,
    content,
    source,
    ...(language ? { language } : {}),
  };
}

export async function loadRelevantSkills(
  filenames: string[],
  skillsRoot = path.resolve(process.env.GITHUB_ACTION_PATH ?? process.cwd(), "skills"),
): Promise<SkillLoadResult> {
  const registryRaw = JSON.parse(
    await readFile(path.join(skillsRoot, "registry.json"), "utf8"),
  ) as unknown;
  const registry = parseRegistry(registryRaw);
  const { detectedLanguages, unmatchedFiles } = detectLanguages(
    filenames,
    registry.languages,
  );

  const manifestRaw = JSON.parse(
    await readFile(path.join(skillsRoot, "manifest.json"), "utf8"),
  ) as unknown;
  if (!isRecord(manifestRaw) || !isRecord(manifestRaw.skills)) {
    throw new Error("Skill manifest must contain a skills object.");
  }

  const selections = new Map<string, { source: LoadedSkill["source"]; language?: string }>();
  for (const skillId of registry.defaultSkills) {
    selections.set(skillId, { source: "default" });
  }
  for (const language of detectedLanguages) {
    for (const skillId of registry.languages[language]?.skills ?? []) {
      if (!selections.has(skillId)) {
        selections.set(skillId, { source: "language", language });
      }
    }
  }

  const skills: LoadedSkill[] = [];
  for (const [skillId, selection] of selections) {
    skills.push(await loadSkill(
      skillsRoot,
      skillId,
      selection.source,
      selection.language,
    ));
  }

  return { skills, detectedLanguages, unmatchedFiles };
}
