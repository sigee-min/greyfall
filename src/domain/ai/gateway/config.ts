import type { LlmManagerKind } from '../../../llm/webllm-engine';
import type { AIGatewayParams, GatewayResolvedConfig } from './types';

export function resolveGatewayConfig(
  manager: LlmManagerKind,
  params: Pick<AIGatewayParams, 'maxTokens' | 'timeoutMs' | 'twoPhase'>
): GatewayResolvedConfig {
  const env = (import.meta as any).env || {};
  const envMax = Number(env?.VITE_LLM_MAX_TOKENS);
  const maxTokEnv = Number.isFinite(envMax) && envMax > 0 ? Math.min(2048, Math.max(32, envMax)) : 128;
  const maxTokens = typeof params.maxTokens === 'number' && params.maxTokens > 0 ? params.maxTokens : maxTokEnv;

  const envTimeout = Number(env?.VITE_LLM_TIMEOUT_MS);
  const defaultTimeout = (() => {
    if (Number.isFinite(envTimeout) && envTimeout! > 0) return Math.min(120_000, Math.max(5_000, envTimeout!));
    if (manager === 'hasty') return 35_000;
    if (manager === 'fast') return 45_000;
    return 60_000;
  })();
  const effectiveTimeout = Math.max(1_000, Math.min(120_000, params.timeoutMs ?? defaultTimeout));

  const envColdTimeout = Number(env?.VITE_LLM_COLD_TIMEOUT_MS);
  const coldStartTimeout = Number.isFinite(envColdTimeout) && envColdTimeout! > 0
    ? Math.min(180_000, Math.max(20_000, envColdTimeout!))
    : 90_000;

  const twoPhaseEnv = String(env?.VITE_LLM_TWO_PHASE ?? '').toLowerCase();
  const twoPhaseByEnv = twoPhaseEnv === '1' || twoPhaseEnv === 'true';
  const useTwoPhase = Boolean(params.twoPhase ?? twoPhaseByEnv);

  return { maxTokens, effectiveTimeout, coldStartTimeout, useTwoPhase };
}

