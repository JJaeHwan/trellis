export type DocumentStatus =
  | "UPLOADED"
  | "PARSING"
  | "PARSED"
  | "EMBEDDING"
  | "READY"
  | "FAILED";

export interface DocumentSummary {
  readonly id: string;
  readonly filename: string;
  readonly originalName: string;
  readonly contentType: string | null;
  readonly fileSize: number | null;
  readonly status: DocumentStatus;
  readonly pageCount: number | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
}

export interface ChunkRef {
  readonly chunkId: string;
  readonly documentId: string;
  readonly content: string;
  readonly pageNumber: number | null;
  readonly chunkIndex: number;
  /** Cosine distance from query (lower = closer). May be undefined if not from search. */
  readonly distance?: number;
}
