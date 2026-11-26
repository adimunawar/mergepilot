import type { AIProvider, ReviewGenerationInput } from "../types.js";

interface NvidiaErrorBody {
  error?: { message?: string; code?: number | string };
  message?: string;
}

interface NvidiaChatCompletionBody {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function getEmptyResponseDiagnostics(completion: NvidiaChatCompletionBody): string {
  const message = completion.choices?.[0]?.message;
  return [
    `prompt_tokens=${completion.usage?.prompt_tokens ?? "unknown"}`,
    `completion_tokens=${completion.usage?.completion_tokens ?? "unknown"}`,
    `reasoning_chars=${message?.reasoning?.length ?? 0}`,
    `content_chars=${message?.content?.length ?? 0}`,
  ].join(", ");
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
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          {
            role: "system",
            content: `${input.systemInstruction}\n\nReturn only valid JSON matching this schema:\n${JSON.stringify(input.responseSchema)}`,
          },
          { role: "user", content: input.prompt },
        ],
        // Nemotron 3 Nano Omni API supports reasoning_budget as a top-level
        // parameter. Keep reasoning bounded so completion tokens remain for JSON.
        reasoning_budget: 4_096,
        max_tokens: 16_384,
        temperature: 0.1,
        top_p: 0.95,
        stream: false,
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
        + ` [${getEmptyResponseDiagnostics(completion)}].`,
      );
    }

    return content;
  }
}
