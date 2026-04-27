import type { LlmMessage } from "@/lib/domain/chat";

/**
 * LLM service contract — provider-agnostic streaming chat.
 * Implementations must yield response text incrementally for SSE-friendly delivery.
 */
export interface LlmService {
  readonly providerName: string;
  chat(messages: LlmMessage[]): AsyncIterable<string>;
}
