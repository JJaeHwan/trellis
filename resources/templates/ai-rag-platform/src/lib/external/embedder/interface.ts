/**
 * Text → fixed-dimension vector. Implementations should be cheap to call
 * and respect a documented `dimension` (must match the pgvector column type).
 */
export interface Embedder {
  readonly providerName: string;
  readonly dimension: number;
  embed(text: string): Promise<number[]>;
}
