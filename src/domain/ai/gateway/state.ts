import type { LlmManagerKind } from '../../../llm/webllm-engine';

const firstGenDoneByManager = new Map<LlmManagerKind, boolean>();

export function isFirstGen(manager: LlmManagerKind): boolean {
  return !firstGenDoneByManager.get(manager);
}

export function markFirstGenDone(manager: LlmManagerKind): void {
  firstGenDoneByManager.set(manager, true);
}

