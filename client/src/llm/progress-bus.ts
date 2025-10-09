export type ProgressReport = { text?: string | null; progress?: number | null };

type Listener = (report: ProgressReport) => void;

const listeners = new Set<Listener>();
let last: ProgressReport | null = null;

export function emitProgress(report: ProgressReport) {
  last = report;
  for (const l of Array.from(listeners)) {
    try { l(report); } catch { /* noop */ }
  }
}

export function subscribeProgress(cb: Listener): () => void {
  listeners.add(cb);
  if (last) {
    try { cb(last); } catch { /* noop */ }
  }
  return () => listeners.delete(cb);
}

export function getLastProgress(): ProgressReport | null { return last; }

export function clearProgress() {
  last = null;
}
