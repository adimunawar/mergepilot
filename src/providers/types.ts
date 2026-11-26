export interface ReviewGenerationInput {
  model: string;
  systemInstruction: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
}

export interface AIProvider {
  generateReview(input: ReviewGenerationInput): Promise<string>;
}
