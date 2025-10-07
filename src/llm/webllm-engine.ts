import {
  loadCpuEngineByManager,
  ensureCpuReady,
  generateCpuChat,
  probeCpuActive,
  resetCpuEngine,
  isCpuInitialised
} from './cpu/cpu-engine';

export type LlmManagerKind = 'fast' | 'smart';

export type ChatOptions = {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (token: string, tokenIndex: number) => void;
};

export type WebLLMProgress = { text?: string; progress?: number };

// CPU-only facade (Transformers.js + ONNX)

export async function loadEngineByManager(
  manager: LlmManagerKind,
  onProgress?: (report: WebLLMProgress) => void
): Promise<void> {
  await loadCpuEngineByManager(manager, onProgress as any);
}

export function resetEngine() { resetCpuEngine(); }

export async function generateChat(prompt: string, options: ChatOptions = {}) {
  return generateCpuChat(prompt, options);
}

export async function ensureChatApiReady(timeoutMs = 8000, onProgress?: (report: WebLLMProgress) => void): Promise<void> {
  await ensureCpuReady(timeoutMs, onProgress as any);
}

export async function probeChatApiActive(timeoutMs = 800): Promise<boolean> {
  return probeCpuActive(timeoutMs);
}

export async function probeChatApiReady(_timeoutMs = 500): Promise<{ initialised: boolean; chatApiReady: boolean }> {
  const ready = isCpuInitialised();
  return { initialised: ready, chatApiReady: ready };
}

// readyz 제거: 필요 시 ensureChatApiReady와 isCpuInitialised 조합으로 확인
export async function readyz(_timeoutMs = 2000): Promise<boolean> {
  return isCpuInitialised();
}
