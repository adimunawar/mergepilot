import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/core/config.js";

describe("loadConfig", () => {
  it("keeps Gemini as the default provider and supports generic credentials", () => {
    expect(loadConfig({ AI_API_KEY: "gemini-key" })).toMatchObject({
      provider: "gemini",
      apiKey: "gemini-key",
      model: "gemini-3.8-flash",
    });
  });

  it("loads the selected NVIDIA key and model", () => {
    expect(loadConfig({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "nvidia-key",
      NVIDIA_MODEL: "catalog/model-id",
    })).toMatchObject({
      provider: "nvidia",
      apiKey: "nvidia-key",
      model: "catalog/model-id",
    });
  });

  it("requires a model for NVIDIA instead of guessing one", () => {
    expect(() => loadConfig({
      AI_PROVIDER: "nvidia",
      NVIDIA_API_KEY: "nvidia-key",
    })).toThrow("AI_MODEL is required");
  });

  it("rejects unknown providers", () => {
    expect(() => loadConfig({
      AI_PROVIDER: "unknown",
      AI_API_KEY: "key",
    })).toThrow("Unsupported AI_PROVIDER");
  });
});
