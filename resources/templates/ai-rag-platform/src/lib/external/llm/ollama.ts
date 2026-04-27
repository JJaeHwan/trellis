import { ProviderError } from "@/lib/common/errors";
import type { LlmMessage } from "@/lib/domain/chat";
import type { LlmService } from "./interface";

interface OllamaChatChunk {
  readonly message?: { readonly content?: string };
  readonly done?: boolean;
}

export class OllamaLlm implements LlmService {
  readonly providerName = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async *chat(messages: LlmMessage[]): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: true }),
    });
    if (!res.ok || !res.body) {
      throw new ProviderError("ollama", `chat failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaChatChunk;
        const piece = chunk.message?.content;
        if (piece) yield piece;
        if (chunk.done) return;
      }
    }
  }
}
