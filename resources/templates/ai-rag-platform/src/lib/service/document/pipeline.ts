import { db } from "@/lib/external/db";
import { getEmbedder } from "@/lib/external/embedder/factory";
import { DocumentProcessingError } from "@/lib/common/errors";
import { parseFile } from "./parser";
import { chunkText } from "./chunker";

/**
 * Process a single document end-to-end:
 *   UPLOADED → PARSING → PARSED → EMBEDDING → READY
 *                              └─→ FAILED
 *
 * Run this from a worker / background task. The HTTP upload endpoint
 * should fire-and-forget this call so the response returns quickly.
 */
export async function processDocument(
  documentId: string,
  fileBuffer: Buffer,
): Promise<void> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw new DocumentProcessingError("pipeline", `document ${documentId} not found`);
  }

  try {
    await db.document.update({
      where: { id: documentId },
      data: { status: "PARSING" },
    });
    const parsed = await parseFile(fileBuffer, doc.contentType);

    await db.document.update({
      where: { id: documentId },
      data: { status: "PARSED", pageCount: parsed.pageCount },
    });

    const chunks = chunkText(parsed.text);
    if (chunks.length === 0) {
      throw new DocumentProcessingError("pipeline", "no extractable text");
    }

    await db.document.update({
      where: { id: documentId },
      data: { status: "EMBEDDING" },
    });

    const embedder = getEmbedder();
    for (const chunk of chunks) {
      const vector = await embedder.embed(chunk.content);
      // pgvector raw SQL — Prisma typed client cannot represent vector type.
      const vectorLiteral = `[${vector.join(",")}]`;
      await db.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" ("id","documentId","content","pageNumber","chunkIndex","embedding","createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector, NOW())`,
        documentId,
        chunk.content,
        chunk.pageNumber,
        chunk.index,
        vectorLiteral,
      );
    }

    await db.document.update({
      where: { id: documentId },
      data: { status: "READY" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.document.update({
      where: { id: documentId },
      data: { status: "FAILED", errorMessage: msg },
    });
    throw e;
  }
}
