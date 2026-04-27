import { ProviderError } from "@/lib/common/errors";
import type { Embedder } from "./interface";

interface OllamaEmbeddingResponse {
  readonly embedding?: readonly number[];
}

export class OllamaEmbedder implements Embedder {
  readonly providerName = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    readonly dimension: number,
  ) {}

  async embed(text: string): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!res.ok) {
      throw new ProviderError("ollama-embed", `HTTP ${res.status}`);
    }
    const data = (await res.json()) as OllamaEmbeddingResponse;
    const vec = data.embedding;
    if (!vec || vec.length !== this.dimension) {
      throw new ProviderError(
        "ollama-embed",
        `dimension mismatch: got ${vec?.length ?? 0}, expected ${this.dimension}`,
      );
    }
    return [...vec];
  }
}
