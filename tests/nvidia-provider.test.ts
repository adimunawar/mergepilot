import { afterEach, describe, expect, it, vi } from "vitest";
import { NvidiaProvider } from "../src/providers/nvidia/nvidia-provider.js";

describe("NvidiaProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  const input = {
    model: "catalog/model-id",
    systemInstruction: "system",
    prompt: "review this diff",
    responseSchema: {},
  };

  it("sends the configured model and returns the assistant JSON content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"summary":"ok","findings":[]}' } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NvidiaProvider("secret-key");
    const result = await provider.generateReview(input);

    expect(result).toBe('{"summary":"ok","findings":[]}');
    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret-key" }),
      }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(request.model).toBe("catalog/model-id");
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(request.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(request.reasoning_budget).toBe(0);
    expect(request.max_tokens).toBe(32_768);
    expect(request.stream).toBe(false);
    expect(request).not.toHaveProperty("reasoning_effort");
  });

  it("preserves HTTP status and NVIDIA error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "Model endpoint deprecated", code: "model_deprecated" } }),
      { status: 410 },
    )));
    const provider = new NvidiaProvider("secret-key");

    await expect(provider.generateReview(input)).rejects.toMatchObject({
      status: 410,
      code: "model_deprecated",
      message: expect.stringContaining("Model endpoint deprecated"),
    });
  });

  it("includes plain-text response details when the API does not return JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "Endpoint retired",
      { status: 410 },
    )));
    const provider = new NvidiaProvider("secret-key");

    await expect(provider.generateReview(input)).rejects.toThrow(
      'NVIDIA API request failed (410) for model "catalog/model-id": Endpoint retired',
    );
  });

  it("includes token diagnostics for empty successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: "length",
        message: { content: " ", reasoning: "internal reasoning" },
      }],
      usage: {
        prompt_tokens: 123,
        completion_tokens: 32_768,
        completion_tokens_details: { reasoning_tokens: 32_768 },
      },
    }), { status: 200 })));
    const provider = new NvidiaProvider("secret-key");

    await expect(provider.generateReview(input)).rejects.toThrow(
      'NVIDIA API returned an empty review response for model "catalog/model-id" (finish_reason: length) [prompt_tokens=123, completion_tokens=32768, reasoning_tokens=32768, reasoning_chars=18, content_chars=1].',
    );
  });
});
