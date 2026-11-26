import type { AIProvider, ReviewGenerationInput } from "../types.js";

interface NvidiaErrorBody {
  error?: { message?: string; code?: number | string };
  message?: string;
}

interface NvidiaChatCompletionBody {
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
}

/** NVIDIA NIM's OpenAI-compatible chat completions adapter. */
export class NvidiaProvider implements AIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://integrate.api.nvidia.com/v1",
  ) {}

  async generateReview(input: ReviewGenerationInput): Promise<string> {
    const endpoint = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.systemInstruction },
          { role: "user", content: input.prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8_192,
        reasoning_effort: "low",
      }),
    });

    const responseText = await response.text();
    let body: NvidiaChatCompletionBody | NvidiaErrorBody = {};
    try {
      body = responseText ? JSON.parse(responseText) as typeof body : {};
    } catch {
      // Keep a short plain-text response for proxies and non-JSON error pages.
    }

    if (!response.ok) {
      const errorBody = body as NvidiaErrorBody;
      const detail = errorBody.error?.message
        ?? errorBody.message
        ?? responseText.slice(0, 500).trim()
        ?? "";
      const suffix = detail ? `: ${detail}` : "";
      const error = new Error(
        `NVIDIA API request failed (${response.status}) for model "${input.model}"${suffix}`,
      ) as Error & { status: number; code?: number | string | undefined };
      error.status = response.status;
      error.code = errorBody.error?.code;
      throw error;
    }

    const completion = body as NvidiaChatCompletionBody;
    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      const finishReason = completion.choices?.[0]?.finish_reason;
      throw new Error(
        `NVIDIA API returned an empty review response for model "${input.model}"`
        + (finishReason ? ` (finish_reason: ${finishReason})` : "")
        + ".",
      );
    }

    return content;
  }
}
