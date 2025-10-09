import { listAllPreloadEntries } from './preload-manifest';
const DEFAULT_PRIORITIES = ['critical', 'recommended'];
const DEFAULT_CONCURRENCY = 2;
function isAbortError(error) {
    return error instanceof DOMException ? error.name === 'AbortError' : false;
}
function waitForIdle() {
    if (typeof window === 'undefined') {
        return Promise.resolve({ didTimeout: false, timeRemaining: () => 16 });
    }
    if ('requestIdleCallback' in window) {
        return new Promise((resolve) => window.requestIdleCallback(resolve, { timeout: 200 }));
    }
    return new Promise((resolve) => {
        setTimeout(() => resolve({ didTimeout: false, timeRemaining: () => 16 }), 16);
    });
}
function loadImage(url, signal) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const cleanup = () => {
            image.onload = null;
            image.onerror = null;
            if (signal)
                signal.removeEventListener('abort', onAbort);
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
async function fetchAsset(url, signal) {
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
async function loadEntry(entry, signal) {
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
    constructor(manifest, options) {
        this.listeners = new Set();
        this.status = 'idle';
        this.active = 0;
        this.completed = 0;
        this.controller = null;
        this.startedAt = null;
        this.manifest = manifest;
        this.include = options?.include ?? DEFAULT_PRIORITIES;
        this.concurrency = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);
        this.entries = options?.entries ?? listAllPreloadEntries(this.include);
        this.queue = this.createQueue();
    }
    on(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    getStatus() {
        return this.status;
    }
    getProgress() {
        return { completed: this.completed, total: this.total() };
    }
    start() {
        if (this.status === 'running')
            return;
        if (this.status === 'done' || this.status === 'cancelled')
            return;
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
    pause() {
        if (this.status !== 'running')
            return;
        this.status = 'paused';
        this.controller?.abort();
        this.controller = null;
        this.emit({ type: 'status', status: this.status });
    }
    resume() {
        if (this.status !== 'paused')
            return;
        this.controller = new AbortController();
        this.status = 'running';
        this.emit({ type: 'status', status: this.status });
        this.pump();
    }
    cancel() {
        if (this.status === 'cancelled' || this.status === 'done')
            return;
        this.status = 'cancelled';
        this.controller?.abort();
        this.controller = null;
        this.queue = [];
        this.emit({ type: 'status', status: this.status });
    }
    createQueue() {
        return this.entries.map((entry) => ({ entry }));
    }
    total() {
        return this.queue.length + this.completed + this.active;
    }
    emit(event) {
        for (const listener of Array.from(this.listeners)) {
            try {
                listener(event);
            }
            catch {
                // ignore listener failures
            }
        }
    }
    async pump() {
        if (this.status !== 'running')
            return;
        if (!this.controller) {
            this.controller = new AbortController();
        }
        while (this.active < this.concurrency && this.queue.length > 0 && this.status === 'running') {
            const next = this.queue.shift();
            if (!next)
                break;
            this.active += 1;
            void this.runTask(next, this.controller.signal).finally(() => {
                this.active -= 1;
                if (this.status === 'running') {
                    this.pump().catch(() => { });
                }
                else if (this.shouldFinalize()) {
                    this.finish();
                }
            });
        }
        if (this.shouldFinalize()) {
            this.finish();
        }
    }
    shouldFinalize() {
        return ((this.queue.length === 0 && this.active === 0) ||
            (this.status === 'paused' && this.queue.length === 0 && this.active === 0));
    }
    finish() {
        if (this.status === 'cancelled' || this.status === 'done')
            return;
        const durationMs = this.startedAt ? Date.now() - this.startedAt : 0;
        this.status = 'done';
        this.controller?.abort();
        this.controller = null;
        this.emit({ type: 'status', status: this.status });
        this.emit({ type: 'done', completed: this.completed, total: this.total(), durationMs });
    }
    async runTask(item, signal) {
        const entry = item.entry;
        try {
            await waitForIdle();
            await loadEntry(entry, signal);
            this.completed += 1;
            this.emit({ type: 'progress', completed: this.completed, total: this.total(), entry });
        }
        catch (error) {
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
