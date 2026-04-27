export type ChatRole = "USER" | "ASSISTANT";

export interface ChatMessageRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly sourceChunkIds: readonly string[];
  readonly createdAt: Date;
}

/** Provider-facing message shape (no IDs, no timestamps). */
export interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}
