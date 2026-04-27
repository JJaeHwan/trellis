import { ProviderError } from "@/lib/common/errors";
import { getEnv } from "@/lib/config/env";
import type { LlmService } from "./interface";
import { OllamaLlm } from "./ollama";
import { OpenAiLlm } from "./openai";
import { AnthropicLlm } from "./anthropic";

let cached: LlmService | undefined;

export function getLlmService(): LlmService {
  if (cached) return cached;
  const env = getEnv();
  switch (env.LLM_PROVIDER) {
    case "ollama":
      cached = new OllamaLlm(env.OLLAMA_URL, env.OLLAMA_LLM_MODEL);
      return cached;
    case "openai":
      cached = new OpenAiLlm(env.OPENAI_API_KEY ?? "", env.OPENAI_LLM_MODEL);
      return cached;
    case "anthropic":
      cached = new AnthropicLlm(
        env.ANTHROPIC_API_KEY ?? "",
        env.ANTHROPIC_LLM_MODEL,
      );
      return cached;
    default:
      throw new ProviderError("llm-factory", `unknown provider: ${env.LLM_PROVIDER as string}`);
  }
}
