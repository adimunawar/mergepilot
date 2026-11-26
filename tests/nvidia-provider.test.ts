import { afterEach, describe, expect, it, vi } from "vitest";
import { NvidiaProvider } from "../src/providers/nvidia/nvidia-provider.js";

describe("NvidiaProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  const input = {
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    systemInstruction: "You are a code reviewer.",
    prompt: "Review this diff.",
    responseSchema: { type: "object", properties: { summary: { type: "string" } } },
  };

  it("uses the Nemotron API parameters and returns JSON content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"summary":"ok"}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NvidiaProvider("secret-key");
    const result = await provider.generateReview(input);

    expect(result).toBe('{"summary":"ok"}');
    expect(fetchMock).toHaveBeenCalledWith(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-key",
          Accept: "application/json",
        }),
      }),
    );
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(request.model).toBe(input.model);
    expect(request.reasoning_budget).toBe(4_096);
    expect(request.max_tokens).toBe(16_384);
    expect(request.stream).toBe(false);
    expect(request.response_format).toBeUndefined();
    expect(request.chat_template_kwargs).toBeUndefined();
    expect(request.messages[0].content).toContain(JSON.stringify(input.responseSchema));
  });

  it("preserves HTTP status and NVIDIA error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "Model endpoint unavailable", code: "model_unavailable" } }),
      { status: 410 },
    )));
    const provider = new NvidiaProvider("secret-key");

    await expect(provider.generateReview(input)).rejects.toMatchObject({
      status: 410,
      code: "model_unavailable",
      message: expect.stringContaining("Model endpoint unavailable"),
    });
  });

  it("includes plain-text response details when the API does not return JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "Endpoint unavailable",
      { status: 503 },
    )));
    const provider = new NvidiaProvider("secret-key");

    await expect(provider.generateReview(input)).rejects.toThrow(
      'NVIDIA API request failed (503) for model "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": Endpoint unavailable',
    );
  });

  it("includes token diagnostics for empty successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: "length",
        message: { content: " ", reasoning: "internal reasoning" },
      }],
      usage: { prompt_tokens: 123, completion_tokens: 16_384, total_tokens: 16_507 },
    }), { status: 200 })));
    const provider = new NvidiaProvider("secret-key");

    await expect(provider.generateReview(input)).rejects.toThrow(
      'NVIDIA API returned an empty review response for model "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning" (finish_reason: length) [prompt_tokens=123, completion_tokens=16384, reasoning_chars=18, content_chars=1].',
    );
  });
});
