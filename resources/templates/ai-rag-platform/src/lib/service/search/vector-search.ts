import { db } from "@/lib/external/db";
import { getEmbedder } from "@/lib/external/embedder/factory";
import type { ChunkRef } from "@/lib/domain/document";

export interface SearchOptions {
  readonly documentIds: readonly string[];
  readonly topK: number;
}

interface RawRow {
  readonly id: string;
  readonly documentId: string;
  readonly content: string;
  readonly pageNumber: number | null;
  readonly chunkIndex: number;
  readonly distance: number;
}

/**
 * Embed the query, then return the nearest chunks scoped to the given documents.
 * Uses pgvector's `<->` cosine distance operator via raw SQL because the
 * Prisma client cannot model the vector column directly.
 */
export async function searchChunks(
  query: string,
  options: SearchOptions,
): Promise<ChunkRef[]> {
  if (options.documentIds.length === 0 || options.topK <= 0) return [];

  const embedder = getEmbedder();
  const queryVec = await embedder.embed(query);
  const queryLiteral = `[${queryVec.join(",")}]`;

  const rows = await db.$queryRawUnsafe<RawRow[]>(
    `SELECT id, "documentId", content, "pageNumber", "chunkIndex",
            embedding <-> $1::vector AS distance
       FROM "DocumentChunk"
      WHERE "documentId" = ANY($2::text[])
        AND embedding IS NOT NULL
      ORDER BY embedding <-> $1::vector
      LIMIT $3`,
    queryLiteral,
    options.documentIds as string[],
    options.topK,
  );

  return rows.map((r) => ({
    chunkId: r.id,
    documentId: r.documentId,
    content: r.content,
    pageNumber: r.pageNumber,
    chunkIndex: r.chunkIndex,
    distance: r.distance,
  }));
}
