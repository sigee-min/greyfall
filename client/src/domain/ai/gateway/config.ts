import type { LlmManagerKind } from '../../../llm/llm-engine';
import type { AIGatewayParams, GatewayResolvedConfig } from './types';

export function resolveGatewayConfig(
  manager: LlmManagerKind,
  params: Pick<AIGatewayParams, 'maxTokens' | 'timeoutMs' | 'twoPhase'>
): GatewayResolvedConfig {
  const env = import.meta.env;
  const envMax = Number(env.VITE_LLM_MAX_TOKENS);
  const maxTokEnv = Number.isFinite(envMax) && envMax > 0 ? Math.min(4096, Math.max(32, envMax)) : 256;
  const maxTokens = typeof params.maxTokens === 'number' && params.maxTokens > 0 ? params.maxTokens : maxTokEnv;

  const perTokenTimeoutMs = 1_500;
  const tokenBudgetTimeout = Math.max(5_000, Math.min(180_000, Math.round(maxTokens * perTokenTimeoutMs)));

  const envTimeout = Number(env.VITE_LLM_TIMEOUT_MS);
  const defaultTimeout = (() => {
    if (Number.isFinite(envTimeout) && envTimeout > 0) return Math.min(180_000, Math.max(5_000, envTimeout));
    if (manager === 'fast') return Math.max(15_000, Math.min(120_000, tokenBudgetTimeout));
    return tokenBudgetTimeout;
  })();
  const effectiveTimeout = Math.max(1_000, Math.min(180_000, params.timeoutMs ?? defaultTimeout));

  const envColdTimeout = Number(env.VITE_LLM_COLD_TIMEOUT_MS);
  const coldStartTimeout = Number.isFinite(envColdTimeout) && envColdTimeout > 0
    ? Math.min(240_000, Math.max(20_000, envColdTimeout))
    : Math.max(120_000, Math.min(240_000, Math.round(tokenBudgetTimeout * 1.5)));

  const twoPhaseEnv = String(env.VITE_LLM_TWO_PHASE ?? '').toLowerCase();
  const twoPhaseByEnv = twoPhaseEnv === '1' || twoPhaseEnv === 'true';
  const useTwoPhase = Boolean(params.twoPhase ?? twoPhaseByEnv);

  return { maxTokens, effectiveTimeout, coldStartTimeout, useTwoPhase };
}
