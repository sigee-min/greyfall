const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/lib/index.js';
// Qwen3 profiles (use prebuilt registry inside WebLLM)
const QWEN3_HASTY = { id: 'Qwen3-0.6B-q4f16_1-MLC' };
const QWEN3_FAST = { id: 'Qwen3-1.7B-q4f32_1-MLC' };
const QWEN3_SMART = { id: 'Qwen3-4B-q0f16-MLC' };
function resolveProfiles(kind) {
    if (kind === 'hasty')
        return [QWEN3_HASTY];
    if (kind === 'fast')
        return [QWEN3_FAST];
    return [QWEN3_SMART];
}
let enginePromise = null;
let runtimePromise = null;
export async function loadQwenEngineByManager(manager, onProgress) {
    if (typeof window === 'undefined') {
        throw new Error('Qwen WebGPU runtime is only available in the browser environment.');
    }
    if (!window.isSecureContext) {
        throw new Error('WebGPU는 보안(HTTPS) 환경에서만 동작합니다. HTTPS 페이지로 접속해 주세요.');
    }
    const nav = navigator;
    if (!('gpu' in nav) || !nav.gpu) {
        throw new Error('이 브라우저는 WebGPU를 지원하지 않습니다. Chrome 113+ (chrome://flags/#enable-unsafe-webgpu) 또는 최신 Edge에서 시도해 주세요.');
    }
    if (!enginePromise) {
        const runtime = await ensureWebLLMRuntime();
        const attempts = resolveProfiles(manager);
        let lastError;
        for (const profile of attempts) {
            try {
                console.info('[webllm] trying model', { id: profile.id });
                enginePromise = runtime.CreateMLCEngine(profile.id, {
                    initProgressCallback: onProgress
                });
                console.info('[webllm] model initialised', { id: profile.id });
                break;
            }
            catch (error) {
                console.warn('[webllm] model init failed', { id: profile.id, error });
                enginePromise = null;
                lastError = error;
            }
        }
        if (!enginePromise)
            throw normaliseEngineError(lastError);
    }
    return enginePromise;
}
// Allow UI to force a fresh initialisation attempt if previous one got stuck
export function resetQwenEngine() {
    enginePromise = null;
}
export async function generateQwenChat(prompt, options = {}) {
    const { systemPrompt = 'You are a seasoned guide who offers concise, practical suggestions.', temperature = 0.7, topP = 0.9, maxTokens = 512, signal, onToken } = options;
    // Assume engine has already been initialised by manager selection path
    const engine = await (enginePromise ?? loadQwenEngineByManager('smart'));
    const completion = await engine.chat.completion({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ],
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        stream: Boolean(onToken),
        signal,
        onNewToken: onToken
            ? (token, progress, metadata) => {
                void progress;
                onToken(token, metadata?.token_id ?? 0);
            }
            : undefined
    });
    return completion.output_text;
}
async function ensureWebLLMRuntime() {
    if (window.webllm)
        return window.webllm;
    if (!runtimePromise) {
        runtimePromise = (async () => {
            try {
                const mod = await loadRuntimeModule(WEBLLM_URL);
                if (mod)
                    return mod;
            }
            catch (error) {
                console.warn('[webllm] failed to load runtime module', error);
            }
            runtimePromise = null;
            throw createRuntimeLoadError(new Error('Runtime module unavailable'));
        })();
    }
    const runtime = await runtimePromise;
    if (!runtime)
        throw new Error('Failed to initialize WebLLM runtime.');
    return runtime;
}
async function loadRuntimeModule(url) {
    if (window.webllm)
        return window.webllm;
    try {
        // Dynamic ESM import from CDN
        const mod = (await import(/* @vite-ignore */ url));
        if (mod && typeof mod.CreateMLCEngine === 'function') {
            return mod;
        }
    }
    catch (error) {
        console.warn('[webllm] dynamic import failed, falling back to script injection', { url, error });
    }
    // Fallback: inject module script and read window.webllm
    await loadScript(url);
    return window.webllm ?? null;
}
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.type = 'module';
        script.crossOrigin = 'anonymous';
        script.async = true;
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => {
            script.remove();
            reject(new Error(`Failed to load ${url}. 네트워크 연결과 CORS 정책을 확인해 주세요.`));
        });
        document.head.appendChild(script);
    });
}
// No custom appConfig is provided; rely on WebLLM's prebuilt model registry.
function normaliseEngineError(error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/navigator\.gpu/i.test(message) || /requestAdapter/i.test(message)) {
        return new Error('브라우저에서 WebGPU 어댑터를 초기화하지 못했습니다. Chrome/Edge 최신 버전에서 WebGPU 설정을 활성화해 주세요.');
    }
    if (/Failed to fetch/i.test(message) || /NetworkError/i.test(message)) {
        return new Error('모델 가중치를 내려받지 못했습니다. 네트워크 상태를 확인하거나 CDN 접근이 가능한 환경에서 다시 시도해 주세요.');
    }
    return new Error(message);
}
function createRuntimeLoadError(error) {
    const details = error instanceof Error ? error.message : undefined;
    return new Error(details
        ? `Failed to initialize WebLLM runtime (${details}). CDN access might be blocked or the package path may be outdated.`
        : 'Failed to initialize WebLLM runtime. CDN access might be blocked or the package path may be outdated.');
}
