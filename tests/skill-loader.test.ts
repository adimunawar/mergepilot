import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadRelevantSkills } from "../src/skills/skill-loader.js";

const temporaryDirectories: string[] = [];

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mergepilot-skills-"));
  temporaryDirectories.push(root);
  await mkdir(path.join(root, "team"), { recursive: true });
  await mkdir(path.join(root, "dart"), { recursive: true });
  await mkdir(path.join(root, "flutter"), { recursive: true });
  await mkdir(path.join(root, "js"), { recursive: true });
  await writeFile(path.join(root, "registry.json"), JSON.stringify({
    version: 1,
    defaultSkills: ["team"],
    languages: {
      dart: { extensions: [".dart"], skills: ["dart", "flutter"] },
      javascript: { extensions: [".js", ".jsx"], skills: ["javascript"] },
    },
  }));
  await writeFile(path.join(root, "manifest.json"), JSON.stringify({
    skills: {
      team: { path: "team/SKILL.md", description: "Team workflow" },
      dart: { path: "dart/SKILL.md", description: "Dart review" },
      flutter: { path: "flutter/SKILL.md", description: "Flutter review" },
      javascript: { path: "js/SKILL.md", description: "JavaScript review" },
    },
  }));
  for (const [folder, label] of [["team", "team"], ["dart", "dart"], ["flutter", "flutter"], ["js", "javascript"]]) {
    await writeFile(path.join(root, folder, "SKILL.md"), `# ${label} skill`);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("loadRelevantSkills", () => {
  it("loads shared skills and only the languages detected in changed files", async () => {
    const root = await createFixture();
    const result = await loadRelevantSkills(
      ["lib/main.dart", "web/app.js", "README.md"],
      root,
    );

    expect(result.detectedLanguages).toEqual(["dart", "javascript"]);
    expect(result.skills.map((skill) => skill.id)).toEqual([
      "team", "dart", "flutter", "javascript",
    ]);
    expect(result.unmatchedFiles).toEqual(["README.md"]);
  });

  it("does not duplicate a skill selected by multiple language mappings", async () => {
    const root = await createFixture();
    const result = await loadRelevantSkills(["src/app.js", "src/other.jsx"], root);
    expect(result.skills.filter((skill) => skill.id === "javascript")).toHaveLength(1);
  });

  it("rejects skill paths that escape the skills directory", async () => {
    const root = await createFixture();
    const manifestPath = path.join(root, "manifest.json");
    await writeFile(manifestPath, JSON.stringify({
      skills: {
        team: { path: "../outside.md", description: "Bad path" },
      },
    }));

    await expect(loadRelevantSkills(["README.md"], root)).rejects.toThrow(
      "escapes skills directory",
    );
  });
});
