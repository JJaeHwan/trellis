import { ProviderError } from "@/lib/common/errors";
import { getEnv } from "@/lib/config/env";
import type { Embedder } from "./interface";
import { OllamaEmbedder } from "./ollama";
import { OpenAiEmbedder } from "./openai";

let cached: Embedder | undefined;

export function getEmbedder(): Embedder {
  if (cached) return cached;
  const env = getEnv();
  switch (env.EMBEDDER_PROVIDER) {
    case "ollama":
      cached = new OllamaEmbedder(
        env.OLLAMA_URL,
        env.OLLAMA_EMBEDDING_MODEL,
        env.EMBEDDING_DIM,
      );
      return cached;
    case "openai":
      cached = new OpenAiEmbedder(
        env.OPENAI_API_KEY ?? "",
        env.OPENAI_EMBEDDING_MODEL,
        env.EMBEDDING_DIM,
      );
      return cached;
    default:
      throw new ProviderError(
        "embedder-factory",
        `unknown provider: ${env.EMBEDDER_PROVIDER as string}`,
      );
  }
}
