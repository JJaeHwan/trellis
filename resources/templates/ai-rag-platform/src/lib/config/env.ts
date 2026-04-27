import { z } from "zod";

const llmProviderSchema = z.enum(["ollama", "openai", "anthropic"]);
const embedderProviderSchema = z.enum(["ollama", "openai"]);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  LLM_PROVIDER: llmProviderSchema.default("ollama"),
  EMBEDDER_PROVIDER: embedderProviderSchema.default("ollama"),
  EMBEDDING_DIM: z.coerce.number().int().positive().default(1024),

  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_LLM_MODEL: z.string().default("llama3.1"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("bge-m3"),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_LLM_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_LLM_MODEL: z.string().default("claude-3-5-haiku-latest"),
});

export type Env = z.infer<typeof envSchema>;
export type LlmProvider = z.infer<typeof llmProviderSchema>;
export type EmbedderProvider = z.infer<typeof embedderProviderSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `invalid environment: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }
  cached = parsed.data;
  return cached;
}
