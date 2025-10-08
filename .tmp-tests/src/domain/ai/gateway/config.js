export function resolveGatewayConfig(manager, params) {
    const env = import.meta.env;
    const envMax = Number(env.VITE_LLM_MAX_TOKENS);
    const maxTokEnv = Number.isFinite(envMax) && envMax > 0 ? Math.min(2048, Math.max(32, envMax)) : 128;
    const maxTokens = typeof params.maxTokens === 'number' && params.maxTokens > 0 ? params.maxTokens : maxTokEnv;
    const envTimeout = Number(env.VITE_LLM_TIMEOUT_MS);
    const defaultTimeout = (() => {
        if (Number.isFinite(envTimeout) && envTimeout > 0)
            return Math.min(120000, Math.max(5000, envTimeout));
        if (manager === 'fast')
            return 45000;
        return 60000;
    })();
    const effectiveTimeout = Math.max(1000, Math.min(120000, params.timeoutMs ?? defaultTimeout));
    const envColdTimeout = Number(env.VITE_LLM_COLD_TIMEOUT_MS);
    const coldStartTimeout = Number.isFinite(envColdTimeout) && envColdTimeout > 0
        ? Math.min(180000, Math.max(20000, envColdTimeout))
        : 90000;
    const twoPhaseEnv = String(env.VITE_LLM_TWO_PHASE ?? '').toLowerCase();
    const twoPhaseByEnv = twoPhaseEnv === '1' || twoPhaseEnv === 'true';
    const useTwoPhase = Boolean(params.twoPhase ?? twoPhaseByEnv);
    return { maxTokens, effectiveTimeout, coldStartTimeout, useTwoPhase };
}
