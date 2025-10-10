export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmLogInput = {
  request_id: string;
  request_type: string;
  messages: ChatMessage[];
  client_at?: string;
  model?: string;
  temperature?: number;
  top_p?: number;
  seed?: number;
  meta?: Record<string, unknown>;
};

export type LlmLogRecord = LlmLogInput & {
  received_at: string; // ISO8601 UTC
  op: 'create' | 'update' | 'delete';
  rev: number; // monotonically increasing per request_id
};

export type IndexEntry = {
  file: string; // filename relative to date dir
  rev: number;
  tombstone?: boolean;
  lastUpdated: number; // epoch ms
};

export type ApiError = { error: string; code?: string };
