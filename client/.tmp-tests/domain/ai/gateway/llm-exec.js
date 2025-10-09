const DEBUG = Boolean(import.meta.env?.VITE_LLM_DEBUG);
async function loadOps() {
    const mod = await import('../../../llm/llm-engine');
    return {
        generateChat: mod.generateChat,
        ensureChatApiReady: mod.ensureChatApiReady,
        loadEngineByManager: mod.loadEngineByManager,
        probeChatApiActive: mod.probeChatApiActive,
        resetEngine: mod.resetEngine
    };
}
export async function ensureRuntimeReady(manager) {
    const { loadEngineByManager, ensureChatApiReady, probeChatApiActive, resetEngine } = await loadOps();
    let attempt = 0;
    while (attempt < 2) {
        try {
            await loadEngineByManager(manager);
            await ensureChatApiReady(manager, 1800000);
            if (!(await probeChatApiActive(1000))) {
                for (let i = 0; i < 6; i += 1) {
                    await sleep(250);
                    const ok = await probeChatApiActive(750);
                    if (ok)
                        break;
                }
            }
            return;
        }
        catch (err) {
            attempt += 1;
            if (attempt >= 2)
                throw err;
            resetEngine('ensureRuntimeReady:retry');
            await sleep(400);
        }
    }
}
export async function generateWithTimeout(user, opts) {
    const { generateChat } = await loadOps();
    const ctl = new AbortController();
    const timerId = setTimeout(() => ctl.abort('ai-gateway-timeout'), opts.timeoutMs);
    try {
        if (DEBUG)
            console.debug(`[llm-exec] generateChat.begin temp=${opts.temperature} maxTokens=${opts.maxTokens}`);
        const raw = (await generateChat(user, {
            systemPrompt: opts.systemPrompt,
            task: opts.task,
            locale: opts.locale,
            temperature: opts.temperature,
            maxTokens: opts.maxTokens,
            signal: ctl.signal
        })).trim();
        if (DEBUG)
            console.debug(`[llm-exec] generateChat.done chars=${raw.length}`);
        return raw;
    }
    finally {
        clearTimeout(timerId);
    }
}
export async function transientRetryGenerate(manager, user, opts) {
    try {
        return await generateWithTimeout(user, opts);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const isTransient = /reading 'engine'|not a function/i.test(message);
        if (!isTransient)
            throw e;
        const { ensureChatApiReady, probeChatApiActive, resetEngine, loadEngineByManager } = await loadOps();
        try {
            resetEngine('transientRetry');
            await sleep(200);
            await loadEngineByManager(manager);
            await ensureChatApiReady(manager, 2000);
            if (!(await probeChatApiActive(1000))) {
                await sleep(300);
            }
        }
        catch (retryErr) {
            if (DEBUG)
                console.debug('[llm-exec] retry remediation failed', formatError(retryErr));
        }
        return await generateWithTimeout(user, { ...opts, timeoutMs: Math.min(12000, Math.max(1000, Math.floor(opts.timeoutMs / 2))) });
    }
}
export async function generateMessagesWithTimeout(manager, messages, opts) {
    // Merge into (systemPrompt, user) pair for our current CPU (Transformers.js) adapter
    const systems = messages.filter((m) => m.role === 'system').map((m) => m.content.trim());
    const users = messages.filter((m) => m.role === 'user').map((m) => m.content.trim());
    const systemPrompt = systems.join('\n').trim() || 'You are a helpful assistant.';
    const user = users.join('\n\n').trim();
    if (DEBUG)
        console.debug(`[llm-exec] messages systems=${systems.length} users=${users.length} timeout=${opts.timeoutMs}`);
    try {
        return await generateWithTimeout(user, {
            systemPrompt,
            task: opts.task,
            locale: opts.locale,
            temperature: opts.temperature,
            maxTokens: opts.maxTokens,
            timeoutMs: opts.timeoutMs
        });
    }
    catch (err) {
        if (DEBUG)
            console.warn(`[llm-exec] generate failed, retrying once reason=${formatError(err)}`);
        return transientRetryGenerate(manager, user, {
            systemPrompt,
            task: opts.task,
            locale: opts.locale,
            temperature: opts.temperature,
            maxTokens: opts.maxTokens,
            timeoutMs: opts.timeoutMs
        });
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function formatError(err) {
    return err instanceof Error ? err.message : String(err);
}
