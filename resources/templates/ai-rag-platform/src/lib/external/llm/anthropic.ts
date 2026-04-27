import Anthropic from "@anthropic-ai/sdk";
import { ProviderError } from "@/lib/common/errors";
import type { LlmMessage } from "@/lib/domain/chat";
import type { LlmService } from "./interface";

export class AnthropicLlm implements LlmService {
  readonly providerName = "anthropic";
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    if (!apiKey) {
      throw new ProviderError("anthropic", "ANTHROPIC_API_KEY missing");
    }
    this.client = new Anthropic({ apiKey });
  }

  async *chat(messages: LlmMessage[]): AsyncIterable<string> {
    // Anthropic API requires `system` to be a separate top-level field.
    const systemMessages = messages.filter((m) => m.role === "system");
    const turnMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: 1024,
      system: systemMessages.map((m) => m.content).join("\n\n") || undefined,
      messages: turnMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }
}
