import type { ProgressReport } from './types';

type Listener = (report: ProgressReport) => void;

const listeners = new Set<Listener>();
let last: ProgressReport | null = null;
let activeRunId: string | null = null;

export function emitProgress(report: ProgressReport) {
  // Attach current run id if not provided
  const r: ProgressReport = { runId: report.runId ?? activeRunId, ...report };
  // Ignore stale run ids when activeRunId is set
  if (activeRunId && r.runId && r.runId !== activeRunId) {
    return;
  }
  last = r;
  for (const cb of Array.from(listeners)) {
    try { cb(r); } catch { /* ignore */ }
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

export function setActiveRunId(runId: string | null) {
  activeRunId = runId;
}

export function getActiveRunId(): string | null { return activeRunId; }
