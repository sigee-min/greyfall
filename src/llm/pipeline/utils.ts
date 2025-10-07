export function renderTemplate(tpl: string, params: Record<string, unknown>): string {
  return tpl.replace(/\$\{\s*([a-zA-Z0-9_\.]+)\s*\}/g, (_m, key) => {
    const val = get(params, String(key));
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

function get(obj: any, path: string): unknown {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export async function withTimeoutRetry<T>(
  work: () => Promise<T>,
  opts: { timeoutMs: number; retries: number; signal?: AbortSignal }
): Promise<T> {
  const { timeoutMs, retries, signal } = opts;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await withTimeout(work(), timeoutMs, signal);
    } catch (err) {
      attempt += 1;
      if (attempt > Math.max(0, retries)) throw err;
      // small backoff
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  let timer: any = null;
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
  ]).finally(() => { if (timer) clearTimeout(timer); });
}

