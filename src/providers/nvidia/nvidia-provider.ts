import type { AIProvider, ReviewGenerationInput } from "../types.js";

interface NvidiaErrorBody {
  error?: { message?: string; code?: number | string };
  message?: string;
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
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as NvidiaErrorBody;
      const error = new Error(
        body.error?.message ?? body.message ?? `NVIDIA API request failed (${response.status}).`,
      ) as Error & { status: number; code?: number | string | undefined };
      error.status = response.status;
      error.code = body.error?.code;
      throw error;
    }

    const body = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  }
}
