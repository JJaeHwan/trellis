import OpenAI from "openai";
import { ProviderError } from "@/lib/common/errors";
import type { LlmMessage } from "@/lib/domain/chat";
import type { LlmService } from "./interface";

export class OpenAiLlm implements LlmService {
  readonly providerName = "openai";
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    if (!apiKey) {
      throw new ProviderError("openai", "OPENAI_API_KEY missing");
    }
    this.client = new OpenAI({ apiKey });
  }

  async *chat(messages: LlmMessage[]): AsyncIterable<string> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });
    for await (const part of stream) {
      const piece = part.choices[0]?.delta?.content;
      if (piece) yield piece;
    }
  }
}
