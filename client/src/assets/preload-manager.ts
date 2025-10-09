import type { PreloadEntry, PreloadPriority, PreloadManifest } from './preload-manifest';
import { listAllPreloadEntries } from './preload-manifest';

export type PreloadManagerStatus = 'idle' | 'running' | 'paused' | 'done' | 'cancelled';

export type PreloadProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'progress'; completed: number; total: number; entry: PreloadEntry }
  | { type: 'error'; completed: number; total: number; entry: PreloadEntry; error: string }
  | { type: 'status'; status: PreloadManagerStatus }
  | { type: 'done'; completed: number; total: number; durationMs: number };

export type PreloadManagerOptions = {
  include?: PreloadPriority[];
  concurrency?: number;
  entries?: PreloadEntry[];
};

type Listener = (event: PreloadProgressEvent) => void;

type QueueItem = {
  entry: PreloadEntry;
};

const DEFAULT_PRIORITIES: PreloadPriority[] = ['critical', 'recommended'];

const DEFAULT_CONCURRENCY = 2;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException ? error.name === 'AbortError' : false;
}

function waitForIdle(): Promise<IdleDeadline> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ didTimeout: false, timeRemaining: () => 16 } as IdleDeadline);
  }
  if ('requestIdleCallback' in window) {
    return new Promise((resolve) => window.requestIdleCallback(resolve, { timeout: 200 }));
  }
  return new Promise((resolve) => {
    setTimeout(() => resolve({ didTimeout: false, timeRemaining: () => 16 } as IdleDeadline), 16);
  });
}

function loadImage(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      image.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    image.decoding = 'async';
    image.onload = () => {
      cleanup();
      resolve();
    };
    image.onerror = () => {
      cleanup();
      reject(new Error(`Failed to preload image: ${url}`));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    image.src = url;
  });
}

async function fetchAsset(url: string, signal: AbortSignal): Promise<void> {
  const response = await fetch(url, {
    signal,
    cache: 'force-cache',
    credentials: 'same-origin',
  });
  if (!response.ok && response.type !== 'opaque') {
    throw new Error(`Preload fetch failed ${response.status} for ${url}`);
  }
  // Drain body to ensure the browser caches content
  await response.arrayBuffer();
}

async function loadEntry(entry: PreloadEntry, signal: AbortSignal): Promise<void> {
  switch (entry.type) {
    case 'image':
      await loadImage(entry.url, signal);
      break;
    case 'audio':
    case 'data':
    case 'font':
    case 'other':
    default:
      await fetchAsset(entry.url, signal);
      break;
  }
}

export class AssetPreloadManager {
  private readonly manifest: PreloadManifest;

  private readonly listeners = new Set<Listener>();

  private queue: QueueItem[];

  private readonly entries: PreloadEntry[];

  private status: PreloadManagerStatus = 'idle';

  private readonly include: PreloadPriority[];

  private readonly concurrency: number;

  private active = 0;

  private completed = 0;

  private controller: AbortController | null = null;

  private startedAt: number | null = null;

  constructor(manifest: PreloadManifest, options?: PreloadManagerOptions) {
    this.manifest = manifest;
    this.include = options?.include ?? DEFAULT_PRIORITIES;
    this.concurrency = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);
    this.entries = options?.entries ?? listAllPreloadEntries(this.include);
    this.queue = this.createQueue();
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStatus(): PreloadManagerStatus {
    return this.status;
  }

  getProgress(): { completed: number; total: number } {
    return { completed: this.completed, total: this.total() };
  }

  start(): void {
    if (this.status === 'running') return;
    if (this.status === 'done' || this.status === 'cancelled') return;
    if (this.queue.length === 0) {
      this.emit({ type: 'done', completed: this.completed, total: this.total(), durationMs: 0 });
      this.status = 'done';
      return;
    }
    this.controller = new AbortController();
    this.status = 'running';
    this.startedAt = this.startedAt ?? Date.now();
    this.emit({ type: 'status', status: this.status });
    this.emit({ type: 'start', total: this.total() });
    this.pump();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.controller?.abort();
    this.controller = null;
    this.emit({ type: 'status', status: this.status });
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.controller = new AbortController();
    this.status = 'running';
    this.emit({ type: 'status', status: this.status });
    this.pump();
  }

  cancel(): void {
    if (this.status === 'cancelled' || this.status === 'done') return;
    this.status = 'cancelled';
    this.controller?.abort();
    this.controller = null;
    this.queue = [];
    this.emit({ type: 'status', status: this.status });
  }

  private createQueue(): QueueItem[] {
    return this.entries.map((entry) => ({ entry }));
  }

  private total(): number {
    return this.queue.length + this.completed + this.active;
  }

  private emit(event: PreloadProgressEvent): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(event);
      } catch {
        // ignore listener failures
      }
    }
  }

  private async pump(): Promise<void> {
    if (this.status !== 'running') return;
    if (!this.controller) {
      this.controller = new AbortController();
    }
    while (this.active < this.concurrency && this.queue.length > 0 && this.status === 'running') {
      const next = this.queue.shift();
      if (!next) break;
      this.active += 1;
      void this.runTask(next, this.controller.signal).finally(() => {
        this.active -= 1;
        if (this.status === 'running') {
          this.pump().catch(() => {});
        } else if (this.shouldFinalize()) {
          this.finish();
        }
      });
    }
    if (this.shouldFinalize()) {
      this.finish();
    }
  }

  private shouldFinalize(): boolean {
    return (
      (this.queue.length === 0 && this.active === 0) ||
      (this.status === 'paused' && this.queue.length === 0 && this.active === 0)
    );
  }

  private finish(): void {
    if (this.status === 'cancelled' || this.status === 'done') return;
    const durationMs = this.startedAt ? Date.now() - this.startedAt : 0;
    this.status = 'done';
    this.controller?.abort();
    this.controller = null;
    this.emit({ type: 'status', status: this.status });
    this.emit({ type: 'done', completed: this.completed, total: this.total(), durationMs });
  }

  private async runTask(item: QueueItem, signal: AbortSignal): Promise<void> {
    const entry = item.entry;
    try {
      await waitForIdle();
      await loadEntry(entry, signal);
      this.completed += 1;
      this.emit({ type: 'progress', completed: this.completed, total: this.total(), entry });
    } catch (error) {
      if (isAbortError(error)) {
        if (this.status !== 'cancelled') {
          this.queue.unshift(item);
        }
        return;
      }
      this.completed += 1;
      this.emit({
        type: 'error',
        completed: this.completed,
        total: this.total(),
        entry,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
