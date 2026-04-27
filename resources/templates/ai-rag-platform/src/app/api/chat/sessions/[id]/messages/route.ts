import { z } from "zod";
import { answerWithRag } from "@/lib/service/chat/rag-chat";
import type { LlmMessage } from "@/lib/domain/chat";

const messageSchema = z.object({
  question: z.string().min(1),
  /** Optional override; falls back to session.documentIds when absent. */
  documentIds: z.array(z.string()).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(
  req: Request,
  _ctx: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("invalid input", { status: 400 });
  }

  // P1 (Session B): resolve session.documentIds from DB when override absent.
  const documentIds = parsed.data.documentIds ?? [];
  const history: LlmMessage[] = parsed.data.history ?? [];

  const { stream, sources } = await answerWithRag({
    question: parsed.data.question,
    documentIds,
    history,
  });

  const encoder = new TextEncoder();
  const sseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `event: sources\ndata: ${JSON.stringify(sources)}\n\n`,
        ),
      );
      try {
        for await (const piece of stream) {
          controller.enqueue(encoder.encode(piece));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`\n[error] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
