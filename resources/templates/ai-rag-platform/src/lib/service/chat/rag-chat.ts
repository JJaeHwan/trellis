import { getLlmService } from "@/lib/external/llm/factory";
import type { LlmMessage } from "@/lib/domain/chat";
import type { ChunkRef } from "@/lib/domain/document";
import { searchChunks } from "@/lib/service/search/vector-search";

export interface RagAnswer {
  readonly stream: AsyncIterable<string>;
  readonly sources: readonly ChunkRef[];
}

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions strictly using the provided document excerpts.
- If the answer is not contained in the excerpts, reply that you don't know.
- Cite the relevant excerpt indices like [1], [2] in your answer.
- Be concise.`;

export async function answerWithRag(args: {
  readonly question: string;
  readonly documentIds: readonly string[];
  readonly history: readonly LlmMessage[];
  readonly topK?: number;
}): Promise<RagAnswer> {
  const sources = await searchChunks(args.question, {
    documentIds: args.documentIds,
    topK: args.topK ?? 5,
  });

  const context = sources
    .map((s, i) => `[${i + 1}] (doc=${s.documentId}, idx=${s.chunkIndex})\n${s.content}`)
    .join("\n\n");

  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...args.history,
    {
      role: "user",
      content: `Question: ${args.question}\n\nExcerpts:\n${context}`,
    },
  ];

  const llm = getLlmService();
  return { stream: llm.chat(messages), sources };
}
