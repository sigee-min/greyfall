export type LlmManagerKind = 'fast' | 'smart';

export type ChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string, tokenIndex: number) => void;
};

export type WebLLMProgress = { text?: string; progress?: number };

// Interface-only stubs (no internal behavior).

export async function loadEngineByManager(
  _manager: LlmManagerKind,
  _onProgress?: (report: WebLLMProgress) => void
): Promise<void> { /* no-op */ }

export function resetEngine(): void { /* no-op */ }

export async function generateChat(_prompt: string, _options: ChatOptions = {}): Promise<string> { return ''; }

export async function ensureChatApiReady(
  _manager: LlmManagerKind,
  _timeoutMs = 0,
  _onProgress?: (report: WebLLMProgress) => void
): Promise<void> { /* no-op */ }

export async function probeChatApiActive(_timeoutMs = 0): Promise<boolean> { return false; }

export async function probeChatApiReady(_timeoutMs = 0): Promise<{ initialised: boolean; chatApiReady: boolean }> {
  return { initialised: false, chatApiReady: false };
}

export async function readyz(_timeoutMs = 0): Promise<boolean> { return true; }

export async function purgeLocalModels(onProgress?: (report: WebLLMProgress) => void): Promise<boolean> {
  try {
    onProgress?.({ text: 'Clearing local model caches…', progress: 0.1 });
    // Clear Cache Storage
    if (typeof caches !== 'undefined') {
      try {
        const keys = await caches.keys();
        for (const k of keys) {
          try { await caches.delete(k); } catch { /* ignore */ }
        }
        try { await caches.delete('transformers-cache'); } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    // Best-effort clear IndexedDB databases
    try {
      const anyWindow: any = window as any;
      if (anyWindow.indexedDB && anyWindow.indexedDB.databases) {
        const dbs = await anyWindow.indexedDB.databases();
        if (Array.isArray(dbs)) {
          for (const db of dbs) {
            const name = (db as any)?.name;
            if (name) {
              try {
                await new Promise((res, rej) => {
                  const req = anyWindow.indexedDB.deleteDatabase(name);
                  req.onsuccess = () => res(null);
                  req.onerror = () => rej(req.error);
                  req.onblocked = () => res(null);
                });
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch { /* ignore */ }
    // Local storage cleanup
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
    onProgress?.({ text: 'Cleared', progress: 1 });
    return true;
  } catch {
    return false;
  }
}
