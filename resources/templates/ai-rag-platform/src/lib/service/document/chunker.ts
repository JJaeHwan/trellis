/**
 * Naive character-based chunker. Adequate for skeleton.
 * Replace with tiktoken-like token-based splitter when needed.
 */
export interface Chunk {
  readonly index: number;
  readonly content: string;
  readonly pageNumber: number | null;
}

export interface ChunkOptions {
  readonly chunkSize: number;
  readonly overlap: number;
}

const DEFAULTS: ChunkOptions = { chunkSize: 1000, overlap: 200 };

export function chunkText(
  text: string,
  options: Partial<ChunkOptions> = {},
): Chunk[] {
  const { chunkSize, overlap } = { ...DEFAULTS, ...options };
  if (chunkSize <= 0) throw new Error("chunkSize must be > 0");
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error("overlap must satisfy 0 <= overlap < chunkSize");
  }

  const chunks: Chunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < text.length) {
    const end = Math.min(cursor + chunkSize, text.length);
    const slice = text.slice(cursor, end).trim();
    if (slice.length > 0) {
      chunks.push({ index, content: slice, pageNumber: null });
      index += 1;
    }
    if (end === text.length) break;
    cursor += chunkSize - overlap;
  }

  return chunks;
}
