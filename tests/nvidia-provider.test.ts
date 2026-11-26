import { afterEach, describe, expect, it, vi } from "vitest";
import { NvidiaProvider } from "../src/providers/nvidia/nvidia-provider.js";

describe("NvidiaProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the configured model and returns the assistant JSON content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"summary":"ok","findings":[]}' } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new NvidiaProvider("secret-key");
    const result = await provider.generateReview({
      model: "catalog/model-id",
      systemInstruction: "system",
      prompt: "review this diff",
      responseSchema: {},
    });

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
  });

  it("preserves HTTP status so transient failures can be retried", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: { message: "Overloaded" } }),
      { status: 503 },
    )));
    const provider = new NvidiaProvider("secret-key");
    await expect(provider.generateReview({
      model: "catalog/model-id",
      systemInstruction: "system",
      prompt: "review",
      responseSchema: {},
    })).rejects.toMatchObject({ status: 503, message: "Overloaded" });
  });
});
