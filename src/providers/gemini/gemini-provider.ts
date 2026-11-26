import { GoogleGenAI } from "@google/genai";
import type { AIProvider, ReviewGenerationInput } from "../types.js";

export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateReview(input: ReviewGenerationInput): Promise<string> {
    const response = await this.client.models.generateContent({
      model: input.model,
      contents: input.prompt,
      config: {
        systemInstruction: input.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: input.responseSchema,
        maxOutputTokens: 8_192,
        temperature: 0.1,
      },
    });
    return response.text ?? "";
  }
}