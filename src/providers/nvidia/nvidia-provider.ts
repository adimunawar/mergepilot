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
    completion_tokens_details?: { reasoning_tokens?: number };
  };
}

function getEmptyResponseDiagnostics(
  completion: NvidiaChatCompletionBody,
): string {
  const message = completion.choices?.[0]?.message;
  const details = [
    `prompt_tokens=${completion.usage?.prompt_tokens ?? "unknown"}`,
    `completion_tokens=${completion.usage?.completion_tokens ?? "unknown"}`,
    `reasoning_tokens=${completion.usage?.completion_tokens_details?.reasoning_tokens ?? "unknown"}`,
    `reasoning_chars=${message?.reasoning?.length ?? 0}`,
    `content_chars=${message?.content?.length ?? 0}`,
  ];
  return details.join(", ");
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
        // Explicitly turn off thinking and cap the reasoning budget as a safeguard.
        chat_template_kwargs: { enable_thinking: false },
        reasoning_budget: 0,
        max_tokens: 32_768,
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
