// Interface-only stubs (no internal behavior).
import { loadTransformersEngineByManager, ensureTransformersReady, generateTransformersChat, probeTransformersActive, resetTransformersEngine, purgeTransformersInstalledModels, isTransformersInitialised } from './transformers/transformers-engine';
export async function loadEngineByManager(manager, onProgress) { await loadTransformersEngineByManager(manager, onProgress); }
export function resetEngine() { resetTransformersEngine(); }
export async function generateChat(prompt, options = {}) { return generateTransformersChat(prompt, options); }
export async function ensureChatApiReady(manager, timeoutMs = 30000, onProgress) { await ensureTransformersReady(manager, timeoutMs, onProgress); }
export async function probeChatApiActive(_timeoutMs = 0) { return probeTransformersActive(); }
export async function probeChatApiReady(_timeoutMs = 0) {
    const ready = isTransformersInitialised();
    return { initialised: ready, chatApiReady: ready };
}
export async function readyz(_timeoutMs = 0) { return true; }
export async function purgeLocalModels(onProgress) {
    const ok = await purgeTransformersInstalledModels(onProgress);
    // Best-effort local/session storage cleanup
    try {
        localStorage.clear();
    }
    catch { }
    try {
        sessionStorage.clear();
    }
    catch { }
    return ok;
}
