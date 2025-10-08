export function renderTemplate(tpl: string, params: Record<string, unknown>): string {
  return tpl.replace(/\$\{\s*([a-zA-Z0-9_.]+)\s*\}/g, (_m, key) => {
    const val = get(params, String(key));
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

function get(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    const record = current as Record<string, unknown>;
    current = record[part];
  }
  return current;
}

export async function withTimeoutRetry<T>(
  work: () => Promise<T>,
  opts: { timeoutMs: number; retries: number; signal?: AbortSignal }
): Promise<T> {
  const { timeoutMs, retries, signal } = opts;
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt <= Math.max(0, retries)) {
    try {
      return await withTimeout(work(), timeoutMs, signal);
    } catch (err) {
      lastError = err;
      attempt += 1;
      if (attempt > Math.max(0, retries)) break;
      await delay(200);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Unknown error'));
}

async function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return await Promise.race([
    p,
    new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), ms);
      if (signal) {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }
    })
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
