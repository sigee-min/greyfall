import { emitProgress } from '../progress-bus';
import { openStream, pushToken, markDone, markError, markAborted } from '../stream-bus';
import { postLlmLog } from '../../lib/logs-client';
const state = { worker: null, initialised: false, initPromise: null };
function ensureWorker() {
    if (state.worker)
        return state.worker;
    const w = new Worker(new URL('./transformers.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (ev) => {
        const raw = typeof ev.data === 'object' && ev.data !== null ? ev.data : {};
        const type = String(raw.type ?? '');
        if (type === 'progress') {
            const text = String(raw.text ?? '');
            // Set initialised when official callback reports 'ready'
            if (text === 'ready') {
                state.initialised = true;
                if (state.initResolve) {
                    try {
                        state.initResolve();
                    }
                    catch { }
                }
                state.initPromise = null;
                state.initResolve = undefined;
                state.initReject = undefined;
            }
            emitProgress({ text, progress: typeof raw.progress === 'number' ? raw.progress : undefined });
        }
        else if (type === 'ready') {
            // Reserved: worker no longer sends explicit 'ready'; rely on progress 'ready'
        }
        else if (type === 'unloaded') {
            state.initialised = false;
            if (state.initReject) {
                try {
                    state.initReject(new Error('worker unloaded'));
                }
                catch { }
            }
            state.initPromise = null;
            state.initResolve = undefined;
            state.initReject = undefined;
        }
        else if (type === 'error' && !('id' in raw && raw.id)) {
            // init-level error (no id)
            state.initialised = false;
            if (state.initReject) {
                try {
                    state.initReject(new Error(String(raw.error ?? 'transformers init error')));
                }
                catch { }
            }
            state.initPromise = null;
            state.initResolve = undefined;
            state.initReject = undefined;
        }
        else if (type === 'purged') {
            // Optional: caller may choose to show a toast; keep progress quiet here
        }
    });
    state.worker = w;
    return w;
}
export function resetTransformersEngine() {
    try {
        state.worker?.postMessage({ type: 'unload' });
    }
    catch { }
    try {
        state.worker?.terminate();
    }
    catch { }
    state.worker = null;
    state.initialised = false;
    state.initPromise = null;
    state.initResolve = undefined;
    state.initReject = undefined;
}
export function isTransformersInitialised() { return state.initialised; }
export async function loadTransformersEngineByManager(_manager, _onProgress) {
    const w = ensureWorker();
    if (state.initialised) {
        emitProgress({ text: 'ready', progress: 1 });
        return;
    }
    if (state.initPromise) {
        await state.initPromise;
        return;
    }
    state.initPromise = new Promise((resolve, reject) => { state.initResolve = resolve; state.initReject = reject; });
    try {
        const appConfig = { hfModelId: 'onnx-community/gemma-3-1b-it-ONNX-GQA', dtype: 'q8' };
        w.postMessage({ type: 'init', appConfig });
    }
    catch (e) {
        const rej = state.initReject;
        state.initPromise = null;
        state.initResolve = undefined;
        state.initReject = undefined;
        if (rej)
            rej(e);
        throw e;
    }
    await state.initPromise;
}
export async function ensureTransformersReady(manager, timeoutMs = 30000, _onProgress) {
    await loadTransformersEngineByManager(manager);
    const start = Date.now();
    while (!state.initialised && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 100));
    }
    if (!state.initialised)
        throw new Error('Transformers generator not ready');
}
export async function probeTransformersActive() {
    return state.initialised;
}
export async function generateTransformersChat(prompt, options) {
    const w = ensureWorker();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const { systemPrompt, temperature, topP, maxTokens, onToken, signal, locale, task } = options ?? {};
    // Open monitoring stream (tee) irrespective of consumer's onToken usage
    const streamId = openStream({
        id,
        promptPreview: String(prompt || '').slice(0, 200),
        systemPreview: typeof systemPrompt === 'string' ? String(systemPrompt).slice(0, 200) : undefined,
        prompt: String(prompt || ''),
        system: typeof systemPrompt === 'string' ? String(systemPrompt) : undefined,
        options: { temperature, topP, maxTokens, locale, task }
    });
    const listeners = new Set();
    const cleanup = () => {
        for (const listener of listeners) {
            w.removeEventListener('message', listener);
        }
        listeners.clear();
    };
    let settled = false;
    let externalAbortReject = () => { };
    const p = new Promise((resolve, reject) => {
        const settleResolve = (value) => {
            if (settled)
                return;
            settled = true;
            resolve(value);
        };
        const settleReject = (reason) => {
            if (settled)
                return;
            settled = true;
            reject(reason);
        };
        externalAbortReject = (reason) => {
            cleanup();
            try {
                markAborted(streamId);
            }
            catch { }
            settleReject(reason ?? new DOMException('Aborted', 'AbortError'));
        };
        let acc = '';
        const onMsg = (ev) => {
            const raw = typeof ev.data === 'object' && ev.data !== null ? ev.data : {};
            if (raw.id !== id)
                return;
            const type = String(raw.type ?? '');
            if (type === 'token') {
                const t = String(raw.token ?? '');
                acc += t;
                try {
                    onToken?.(t, 0);
                }
                catch { }
                try {
                    pushToken(streamId, t);
                }
                catch { }
            }
            else if (type === 'done') {
                cleanup();
                const text = String(raw.text ?? acc);
                try {
                    markDone(streamId, text);
                }
                catch { }
                // Fire-and-forget: append LLM log to server
                try {
                    const system = typeof systemPrompt === 'string' ? systemPrompt : '';
                    const inputCombined = `${system}${system ? '\n\n' : ''}${prompt}`;
                    const reqType = options?.task || 'chat';
                    void postLlmLog({
                        request_id: streamId,
                        request_type: reqType,
                        input_text: inputCombined,
                        output_text: text
                    });
                }
                catch { /* ignore log errors */ }
                settleResolve(text);
            }
            else if (type === 'aborted') {
                cleanup();
                try {
                    markAborted(streamId);
                }
                catch { }
                settleReject(new DOMException('Aborted', 'AbortError'));
            }
            else if (type === 'error') {
                cleanup();
                const errMsg = String(raw.error ?? 'transformers error');
                try {
                    markError(streamId, errMsg);
                }
                catch { }
                settleReject(new Error(errMsg));
            }
        };
        listeners.add(onMsg);
        w.addEventListener('message', onMsg);
        try {
            w.postMessage({ type: 'run', id, prompt, systemPrompt, temperature, topP, maxTokens, locale, task });
        }
        catch (e) {
            cleanup();
            const errorMessage = e instanceof Error ? e.message : String(e);
            try {
                markError(streamId, errorMessage);
            }
            catch { }
            settleReject(e instanceof Error ? e : new Error(errorMessage));
        }
    });
    if (signal) {
        if (signal.aborted) {
            try {
                w.postMessage({ type: 'abort', id });
            }
            catch { }
            externalAbortReject(new DOMException('Aborted', 'AbortError'));
            return await p;
        }
        const onAbort = () => {
            try {
                w.postMessage({ type: 'abort', id });
            }
            catch { }
            externalAbortReject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            return await p;
        }
        finally {
            signal.removeEventListener('abort', onAbort);
        }
    }
    return p;
}
export async function purgeTransformersInstalledModels(onProgress, timeoutMs = 10000) {
    const w = ensureWorker();
    return await new Promise((resolve) => {
        let done = false;
        const listener = (ev) => {
            const raw = typeof ev.data === 'object' && ev.data !== null ? ev.data : {};
            const type = String(raw.type ?? '');
            if (type === 'progress') {
                try {
                    onProgress?.({
                        text: typeof raw.text === 'string' ? raw.text : undefined,
                        progress: typeof raw.progress === 'number' ? raw.progress : undefined
                    });
                }
                catch { }
            }
            else if (type === 'purged') {
                done = true;
                cleanup();
                resolve(true);
            }
        };
        const cleanup = () => { w.removeEventListener('message', listener); };
        w.addEventListener('message', listener);
        try {
            w.postMessage({ type: 'purge' });
        }
        catch {
            cleanup();
            resolve(false);
        }
        setTimeout(() => { if (!done) {
            cleanup();
            resolve(false);
        } }, timeoutMs);
    });
}
