export type AIProviderName = "gemini" | "nvidia";

export interface MergePilotConfig {
  provider: AIProviderName;
  apiKey: string;
  model: string;
  baseUrl?: string | undefined;
  targetBranches: string[];
}

const DEFAULT_MODELS: Record<AIProviderName, string> = {
  gemini: "gemini-3.8-flash",
  nvidia: "",
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MergePilotConfig {
  const providerValue = (env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (providerValue !== "gemini" && providerValue !== "nvidia") {
    throw new Error(`Unsupported AI_PROVIDER "${providerValue}". Supported providers: gemini, nvidia.`);
  }
  const provider: AIProviderName = providerValue;
  const apiKey = (env.AI_API_KEY || (provider === "gemini" ? env.GEMINI_API_KEY : env.NVIDIA_API_KEY))?.trim();
  if (!apiKey) {
    const keyName = provider === "gemini" ? "AI_API_KEY or GEMINI_API_KEY" : "AI_API_KEY or NVIDIA_API_KEY";
    throw new Error(`${keyName} is required when AI_PROVIDER is "${provider}".`);
  }
  const model = (env.AI_MODEL || (provider === "gemini" ? env.GEMINI_MODEL : env.NVIDIA_MODEL) || DEFAULT_MODELS[provider]).trim();
  if (!model) throw new Error(`AI_MODEL is required when AI_PROVIDER is "${provider}".`);

  return {
    provider, apiKey, model,
    baseUrl: env.AI_BASE_URL?.trim() || undefined,
    targetBranches: (env.MERGEPILOT_TARGET_BRANCHES || "develop").split(",").map((branch) => branch.trim()).filter(Boolean),
  };
}