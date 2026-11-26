export interface MergePilotConfig {
  provider: "gemini";
  geminiApiKey: string;
  geminiModel: string;
  targetBranches: string[];
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): MergePilotConfig {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required.");
  }

  return {
    provider: "gemini",
    geminiApiKey: apiKey,
    // Keep model selection configurable; model availability and free-tier
    // quotas can change independently of this project.
    geminiModel: env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    targetBranches: (env.MERGEPILOT_TARGET_BRANCHES || "develop")
      .split(",")
      .map((branch) => branch.trim())
      .filter(Boolean),
  };
}
