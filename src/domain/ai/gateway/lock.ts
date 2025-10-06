import type { LlmManagerKind } from '../../../llm/webllm-engine';

// Per-manager FIFO lock to prevent concurrent generations on the same engine
const inflightByManager = new Map<LlmManagerKind, Promise<void>>();

export async function runWithManagerLock<T>(manager: LlmManagerKind, task: () => Promise<T>): Promise<T> {
  if (!inflightByManager.has(manager)) {
    inflightByManager.set(manager, Promise.resolve());
  }
  const prev = inflightByManager.get(manager)!;
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  inflightByManager.set(manager, prev.then(() => gate));

  try {
    await prev;
  } catch {
    // Prior failure does not block the queue
  }

  try {
    const result = await task();
    release();
    return result;
  } catch (err) {
    release();
    throw err;
  }
}

