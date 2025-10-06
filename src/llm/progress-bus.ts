import type { ProgressReport } from './types';

type Listener = (report: ProgressReport) => void;

const listeners = new Set<Listener>();
let last: ProgressReport | null = null;

export function emitProgress(report: ProgressReport) {
  last = report;
  for (const cb of Array.from(listeners)) {
    try { cb(report); } catch { /* ignore */ }
  }
}

export function subscribeProgress(cb: Listener): () => void {
  listeners.add(cb);
  // Best-effort replay last state to new subscriber
  if (last) {
    try { cb(last); } catch { /* ignore */ }
  }
  return () => { listeners.delete(cb); };
}

export function getLastProgress(): ProgressReport | null { return last; }

