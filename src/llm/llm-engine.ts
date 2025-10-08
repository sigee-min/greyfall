export type LlmManagerKind = 'fast' | 'smart';

export type ChatOptions = {
  systemPrompt?: string;
  task?: string;
  locale?: 'ko' | 'en';
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string, tokenIndex: number) => void;
};

export type WebLLMProgress = { text?: string; progress?: number };

// Interface-only stubs (no internal behavior).

import {
  loadTransformersEngineByManager,
  ensureTransformersReady,
  generateTransformersChat,
  probeTransformersActive,
  resetTransformersEngine,
  purgeTransformersInstalledModels,
  isTransformersInitialised
} from './transformers/transformers-engine';

export async function loadEngineByManager(
  manager: LlmManagerKind,
  onProgress?: (report: WebLLMProgress) => void
): Promise<void> { await loadTransformersEngineByManager(manager, onProgress); }

export function resetEngine(): void { resetTransformersEngine(); }

export async function generateChat(prompt: string, options: ChatOptions = {}): Promise<string> { return generateTransformersChat(prompt, options); }

export async function ensureChatApiReady(
  manager: LlmManagerKind,
  timeoutMs = 30_000,
  onProgress?: (report: WebLLMProgress) => void
): Promise<void> { await ensureTransformersReady(manager, timeoutMs, onProgress); }

export async function probeChatApiActive(_timeoutMs = 0): Promise<boolean> { return probeTransformersActive(); }

export async function probeChatApiReady(_timeoutMs = 0): Promise<{ initialised: boolean; chatApiReady: boolean }> {
  const ready = isTransformersInitialised();
  return { initialised: ready, chatApiReady: ready };
}

export async function readyz(_timeoutMs = 0): Promise<boolean> { return true; }

export async function purgeLocalModels(onProgress?: (report: WebLLMProgress) => void): Promise<boolean> {
  const ok = await purgeTransformersInstalledModels(onProgress);
  // Best-effort local/session storage cleanup
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  return ok;
}
