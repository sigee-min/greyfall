export type StreamStatus = 'open' | 'done' | 'error' | 'aborted';

export type StreamMeta = {
  id: string;
  startedAt: number;
  promptPreview?: string;
  systemPreview?: string;
  // Optional full texts for richer monitor view
  prompt?: string;
  system?: string;
  options?: { temperature?: number; topP?: number; maxTokens?: number };
};

export type StreamSnapshot = {
  meta: StreamMeta;
  status: StreamStatus;
  tokenCount: number;
  firstTokenAt?: number;
  endedAt?: number;
  error?: string;
  // Concise rolling window of tokens to avoid memory blowup
  tailText: string;
};

export type StreamEvent =
  | { type: 'open'; meta: StreamMeta }
  | { type: 'token'; id: string; token: string; index: number }
  | { type: 'done'; id: string; fullTextLength: number; durationMs: number }
  | { type: 'error'; id: string; error: string }
  | { type: 'aborted'; id: string };

type Listener = (e: StreamEvent) => void;

const listeners = new Set<Listener>();
const streams = new Map<string, {
  meta: StreamMeta;
  status: StreamStatus;
  tokenCount: number;
  firstTokenAt?: number;
  endedAt?: number;
  error?: string;
  tailText: string;
  fullText?: string; // optional, only when provided by engine at done()
}>();

function emit(e: StreamEvent) {
  for (const l of Array.from(listeners)) { try { l(e); } catch { /* noop */ } }
}

export function subscribeStreams(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function openStream(metaIn: Omit<StreamMeta, 'id' | 'startedAt'> & { id?: string }): string {
  const id = metaIn.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const meta: StreamMeta = {
    id,
    startedAt: Date.now(),
    promptPreview: metaIn.promptPreview,
    systemPreview: metaIn.systemPreview,
    prompt: metaIn.prompt,
    system: metaIn.system,
    options: metaIn.options
  };
  streams.set(id, { meta, status: 'open', tokenCount: 0, tailText: '' });
  emit({ type: 'open', meta });
  return id;
}

export function pushToken(id: string, token: string): number {
  const st = streams.get(id);
  if (!st) return -1;
  st.tokenCount += 1;
  if (!st.firstTokenAt) st.firstTokenAt = Date.now();
  // Keep only a rolling tail to avoid growing indefinitely
  const next = (st.tailText + token);
  st.tailText = next.length > 4000 ? next.slice(-4000) : next;
  emit({ type: 'token', id, token, index: st.tokenCount - 1 });
  return st.tokenCount;
}

export function markDone(id: string, fullText?: string): void {
  const st = streams.get(id);
  if (!st) return;
  st.status = 'done';
  st.endedAt = Date.now();
  if (typeof fullText === 'string') st.fullText = fullText;
  emit({ type: 'done', id, fullTextLength: (fullText?.length ?? st.tailText.length), durationMs: st.endedAt - st.meta.startedAt });
}

export function markError(id: string, error: string): void {
  const st = streams.get(id);
  if (!st) return;
  st.status = 'error';
  st.error = error;
  st.endedAt = Date.now();
  emit({ type: 'error', id, error });
}

export function markAborted(id: string): void {
  const st = streams.get(id);
  if (!st) return;
  st.status = 'aborted';
  st.endedAt = Date.now();
  emit({ type: 'aborted', id });
}

export function getStreamSnapshot(id: string): StreamSnapshot | null {
  const st = streams.get(id);
  if (!st) return null;
  return { meta: st.meta, status: st.status, tokenCount: st.tokenCount, firstTokenAt: st.firstTokenAt, endedAt: st.endedAt, error: st.error, tailText: st.tailText };
}

export function listStreams(): StreamSnapshot[] {
  return Array.from(streams.values()).map((st) => ({ meta: st.meta, status: st.status, tokenCount: st.tokenCount, firstTokenAt: st.firstTokenAt, endedAt: st.endedAt, error: st.error, tailText: st.tailText }));
}
