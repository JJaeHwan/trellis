import OpenAI from "openai";
import { ProviderError } from "@/lib/common/errors";
import type { Embedder } from "./interface";

export class OpenAiEmbedder implements Embedder {
  readonly providerName = "openai";
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    readonly dimension: number,
  ) {
    if (!apiKey) {
      throw new ProviderError("openai-embed", "OPENAI_API_KEY missing");
    }
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimension,
    });
    const vec = res.data[0]?.embedding;
    if (!vec || vec.length !== this.dimension) {
      throw new ProviderError(
        "openai-embed",
        `dimension mismatch: got ${vec?.length ?? 0}, expected ${this.dimension}`,
      );
    }
    return [...vec];
  }
}
