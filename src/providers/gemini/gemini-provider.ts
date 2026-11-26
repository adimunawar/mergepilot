import { GoogleGenAI } from "@google/genai";
import type { ReviewResult } from "../../core/types.js";

export interface ReviewInput {
  model: string;
  systemInstruction: string;
  prompt: string;
}

/**
 * Initial provider boundary. Output parsing and schema validation will be
 * implemented in the review pipeline before this provider is used in CI.
 */
export class GeminiProvider {
  constructor(private readonly client: GoogleGenAI) {}

  async generateReview(input: ReviewInput): Promise<string> {
    const response = await this.client.models.generateContent({
      model: input.model,
      contents: input.prompt,
      config: { systemInstruction: input.systemInstruction },
    });

    return response.text ?? "";
  }
}
